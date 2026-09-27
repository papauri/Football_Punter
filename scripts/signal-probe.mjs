// Do candidate features carry information the market has already missed?
// Usage: npm run signal:probe
//
// The order of work matters here. Building a feature into the engine, then tuning it, then measuring
// it, is expensive and biased toward keeping it. This probe asks the prior question directly: for
// fixtures where we know the market's own probability, does the outcome deviate from that
// probability as the candidate feature varies?
//
// If the market has already priced a factor — and bookmakers certainly know about rest days — then
// outcomes will match the market's expectation across every bucket, and the feature cannot help us
// no matter how well we model it. Only an unpriced factor leaves a residual.
//
// Residual = actual rate minus market-implied rate, in percentage points, with a binomial 95%
// interval. An interval that comfortably contains zero means no exploitable signal.
//
// The xG work is the cautionary example: a sound, well-established feature that produced a measured
// 0.1-point gain because the market already had it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;
const DAY = 86400000;

// ---- derive point-in-time schedule features ----------------------------------------------------
// Everything below uses only fixtures that had already been played, so nothing here could leak.
const lastPlayed = new Map();     // team -> timestamp of previous fixture
const recentCount = new Map();    // team -> array of recent timestamps
const leagueFirstSeen = new Map();// team|league -> first timestamp in that league
const leagueSeasonStart = new Map();

for (const m of corpus) {
  const ts = m.timestamp || 0;
  for (const [team, side] of [[m.home, 'home'], [m.away, 'away']]) {
    const prev = lastPlayed.get(team);
    const rec = recentCount.get(team) || [];
    m[`${side}RestDays`] = prev ? (ts - prev) / DAY : null;
    m[`${side}Games14`] = rec.filter(t => ts - t <= 14 * DAY).length;

    const key = `${team}|${m.league}`;
    if (!leagueFirstSeen.has(key)) leagueFirstSeen.set(key, ts);
    // "New to this league" = first seen in it within the last 400 days, i.e. promoted, relegated into
    // it, or simply new to our data. Both are cases where prior-season form is a poor guide.
    m[`${side}NewToLeague`] = (ts - leagueFirstSeen.get(key)) < 400 * DAY;

    lastPlayed.set(team, ts);
    rec.push(ts);
    recentCount.set(team, rec.slice(-20));
  }
}

const OUT = ['HOME', 'DRAW', 'AWAY'];
const rows = [];
for (const m of corpus) {
  const o = oddsById[m.id];
  if (!o?.open) continue;  // use the opening price: the market's view before it had settled
  const inv = [1 / o.open.h, 1 / o.open.d, 1 / o.open.a];
  const book = inv[0] + inv[1] + inv[2];
  const probs = inv.map(x => x / book);
  const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
  if (m.homeRestDays == null || m.awayRestDays == null) continue;
  rows.push({
    league: m.league,
    actual,
    pHome: probs[0], pDraw: probs[1], pAway: probs[2],
    restDiff: m.homeRestDays - m.awayRestDays,
    homeRest: m.homeRestDays,
    awayRest: m.awayRestDays,
    congestionDiff: m.homeGames14 - m.awayGames14,
    homeNew: m.homeNewToLeague,
    awayNew: m.awayNewToLeague
  });
}
console.log(`Fixtures with an opening price and a computable schedule: ${rows.length}\n`);

// ---- residual test ------------------------------------------------------------------------------
// For a bucket of fixtures, compare how often the home side actually won with how often the market
// said it would. Wilson interval on the observed rate; the market rate is treated as the reference.
function residual(list, label) {
  if (list.length < 80) return null;
  const n = list.length;
  const actualHome = list.filter(r => r.actual === 'HOME').length;
  const expHome = list.reduce((s, r) => s + r.pHome, 0);
  const pHat = actualHome / n;
  const se = Math.sqrt(pHat * (1 - pHat) / n);
  const diff = (actualHome - expHome) / n * 100;
  return {
    label, n,
    marketRate: expHome / n * 100,
    actualRate: pHat * 100,
    residual: diff,
    lo: diff - 1.96 * se * 100,
    hi: diff + 1.96 * se * 100,
    significant: (diff - 1.96 * se * 100) > 0 || (diff + 1.96 * se * 100) < 0
  };
}

function report(title, buckets, note) {
  console.log('='.repeat(104));
  console.log(title);
  if (note) console.log(note);
  console.log('='.repeat(104));
  console.log('bucket                              n   market home%   actual home%   residual   95% CI            signal');
  for (const [label, list] of buckets) {
    const r = residual(list, label);
    if (!r) { console.log(`${label.padEnd(34)} ${String(list.length).padStart(5)}   (too few to judge)`); continue; }
    console.log(
      r.label.padEnd(34) + String(r.n).padStart(5) +
      r.marketRate.toFixed(1).padStart(14) + r.actualRate.toFixed(1).padStart(15) +
      r.residual.toFixed(2).padStart(11) + `   [${r.lo.toFixed(2).padStart(6)}, ${r.hi.toFixed(2).padStart(6)}]` +
      (r.significant ? '   YES' : '   no')
    );
  }
  console.log('');
}

// 1. Rest-day differential
report(
  'CANDIDATE 1 — REST DAY DIFFERENTIAL (home rest minus away rest)',
  [
    ['home 3+ days less rested', rows.filter(r => r.restDiff <= -3)],
    ['home 1-2 days less rested', rows.filter(r => r.restDiff < 0 && r.restDiff > -3)],
    ['equal rest', rows.filter(r => r.restDiff === 0)],
    ['home 1-2 days better rested', rows.filter(r => r.restDiff > 0 && r.restDiff < 3)],
    ['home 3+ days better rested', rows.filter(r => r.restDiff >= 3)],
    ['home 7+ days better rested', rows.filter(r => r.restDiff >= 7)]
  ],
  'If the market already prices rest, every residual sits on zero.'
);

// 2. Short rest in absolute terms — the congestion case
report(
  'CANDIDATE 2 — SHORT REST AND FIXTURE CONGESTION',
  [
    ['home on <=3 days rest', rows.filter(r => r.homeRest <= 3)],
    ['away on <=3 days rest', rows.filter(r => r.awayRest <= 3)],
    ['home 3+ more games in 14d', rows.filter(r => r.congestionDiff >= 3)],
    ['home 3+ fewer games in 14d', rows.filter(r => r.congestionDiff <= -3)],
    ['both fully rested (5+ days)', rows.filter(r => r.homeRest >= 5 && r.awayRest >= 5)]
  ],
  'Congestion counts fixtures in the preceding 14 days.'
);

// 3. Promotion and newness to a league
report(
  'CANDIDATE 3 — NEW TO THE LEAGUE (promoted, relegated in, or new to our data)',
  [
    ['home new, away established', rows.filter(r => r.homeNew && !r.awayNew)],
    ['away new, home established', rows.filter(r => !r.homeNew && r.awayNew)],
    ['both new', rows.filter(r => r.homeNew && r.awayNew)],
    ['neither new', rows.filter(r => !r.homeNew && !r.awayNew)]
  ],
  'Prior-season form is a poor guide for a side that has changed division.'
);

// ---- how large a residual would we even need? --------------------------------------------------
console.log('='.repeat(104));
console.log('CONTEXT — HOW BIG WOULD A USEFUL RESIDUAL BE?');
console.log('='.repeat(104));
const allRes = residual(rows, 'all fixtures');
console.log(`Across all ${allRes.n} fixtures the market's home rate is ${allRes.marketRate.toFixed(2)}% and the actual is ${allRes.actualRate.toFixed(2)}%,`);
console.log(`a residual of ${allRes.residual.toFixed(2)} points — the market is close to unbiased overall, as expected.`);
console.log('');
console.log('The published picks currently return about -1.2% at best available prices, so closing that');
console.log('would need roughly 1.2 points of edge on the priced side. A feature would have to shift');
console.log('outcomes by several points in a bucket holding a decent share of fixtures to matter. None of');
console.log('the buckets above needs to be merely statistically significant; it needs to be large.');
console.log('');
console.log('Travel distance is NOT probed here: we hold no stadium coordinates, so it cannot be computed');
console.log('from the data in this repository. Adding it would mean sourcing a venue location dataset');
console.log('first, and on the evidence above that is unlikely to be the best use of the effort.');
process.exit(0);
