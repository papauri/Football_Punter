// Hit rate, ours against the bookmaker's, on identical fixtures and identical markets.
// Usage: npm run hitrate
//
// Hit rate on its own flatters this model badly. Double chance and draw-no-bet land about 78% of the
// time by construction, so a month of green ticks says nothing, and our confident picks turn out to
// be the bookmaker's favourite almost every time — restating the price at a shorter one. The only
// number that means anything is ours beside theirs on the same games, which is what this prints.
//
// Split discipline matches scripts/odds-backtest.mjs: the engine trains on everything before the
// most recent 9,000 fixtures, and results are reported on the second half of the fixtures in that
// window which have closing odds. The calibration map's fit window is checked for overlap and
// flagged loudly, because a map that has seen the test fixtures would quietly grade its own work.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');
const { getLeaguePredictabilityTier, isLeagueSolid, isLeagueBlacklisted } = await import('../src/utils/leagueUtils.js');

const HOLDOUT = 9000;

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;
const test = corpus.slice(-HOLDOUT);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-hitrate-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(corpus.slice(0, -HOLDOUT)));
// The calibration map lives in data/, and the engine resolves it from the working directory. Copy
// the real one in so the evaluated model is the model that ships, rather than an uncalibrated one.
fs.mkdirSync(path.join(trainDir, 'data'), { recursive: true });
if (fs.existsSync('data/calibration.json')) fs.copyFileSync('data/calibration.json', path.join(trainDir, 'data', 'calibration.json'));
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const OUT = ['HOME', 'DRAW', 'AWAY'];
const argmax = v => v.indexOf(Math.max(...v));
const pct = (h, n) => (n ? (h / n * 100).toFixed(1) + '%' : '-');

const rows = [];
for (const m of test) {
  const o = oddsById[m.id];
  if (!o) continue;
  const inv = [1 / o.h, 1 / o.d, 1 / o.a];
  const book = inv[0] + inv[1] + inv[2];
  const market = inv.map(x => x / book); // de-vigged implied probabilities
  const marketOpt = {
    homeOdds: o.h, drawOdds: o.d, awayOdds: o.a,
    homeProb: market[0] * 100, drawProb: market[1] * 100, awayProb: market[2] * 100,
    marketFav: market[0] >= market[2] ? 'HOME' : 'AWAY'
  };
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
  const live = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, odds: marketOpt });
  rows.push({
    league: m.league,
    timestamp: m.timestamp || 0,
    allowed: !isLeagueBlacklisted(m.league) && !engine.isLeagueDisabled(m.league),
    tier1: getLeaguePredictabilityTier(m.league)?.tier === 1,
    solid: isLeagueSolid(m.league),
    actual: m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW',
    model: [p.home, p.draw, p.away].map(x => x / 100),
    blend: [live.home, live.draw, live.away].map(x => x / 100),
    market,
    smart: live.smartMarket
  });
}
const all = rows.slice(Math.floor(rows.length / 2));
const allowed = all.filter(r => r.allowed);

// Does the shipped calibration map overlap the fixtures we are about to grade?
const calMeta = engine.probabilityCalibration?.meta || {};
const earliestTest = Math.min(...all.map(r => r.timestamp).filter(Boolean));
const overlap = calMeta.fittedThroughTimestamp && earliestTest && calMeta.fittedThroughTimestamp >= earliestTest;
console.log(`Holdout fixtures with closing odds: ${all.length}   (app-allowed leagues: ${allowed.length})`);
console.log(`Calibration: ${calMeta.fitted === false ? 'NOT FITTED — probabilities are raw' : `fitted through ${String(calMeta.fitWindowEnd).slice(0, 10)}`}`);
if (overlap) {
  console.log('  *** WARNING: the calibration map was fitted on fixtures inside this test window.');
  console.log('  *** Figures below flatter the model. Refit with: node scripts/fit-calibration.mjs --reserve 9000');
}
console.log('');

const hit = (list, key) => {
  let h = 0;
  for (const r of list) if (OUT[argmax(r[key])] === r.actual) h++;
  return { h, n: list.length, s: pct(h, list.length) };
};
const dc = (list, key) => {
  let h = 0;
  for (const r of list) {
    const fav = r[key][0] >= r[key][2] ? 'HOME' : 'AWAY';
    if (r.actual === fav || r.actual === 'DRAW') h++;
  }
  return { h, n: list.length, s: pct(h, list.length) };
};
const dnb = (list, key) => {
  let h = 0, n = 0;
  for (const r of list) {
    const fav = r[key][0] >= r[key][2] ? 'HOME' : 'AWAY';
    if (r.actual === 'DRAW') continue;
    n++;
    if (r.actual === fav) h++;
  }
  return { h, n, s: pct(h, n) };
};
const brier = (list, key) => {
  let b = 0;
  for (const r of list) b += r[key].reduce((s, x, i) => s + (x - (OUT[i] === r.actual ? 1 : 0)) ** 2, 0) / 3;
  return list.length ? b / list.length : NaN;
};

function compare(label, list, fn) {
  if (!list.length) return;
  const mo = fn(list, 'model'), bl = fn(list, 'blend'), mk = fn(list, 'market');
  const gap = (parseFloat(mo.s) - parseFloat(mk.s)).toFixed(1);
  console.log(`  ${label.padEnd(26)} model ${mo.s.padStart(6)}   blend ${bl.s.padStart(6)}   BOOKMAKER ${mk.s.padStart(6)}   gap ${(gap >= 0 ? '+' : '') + gap}   (n=${mk.n})`);
}

console.log('1X2 STRAIGHT PICK');
compare('All leagues', all, hit);
compare('App-allowed leagues', allowed, hit);
compare('Tier 1 (High Edge)', all.filter(r => r.tier1), hit);
compare('Solid leagues', all.filter(r => r.solid), hit);

console.log('\nDOUBLE CHANCE (favourite or draw)');
compare('All leagues', all, dc);
compare('App-allowed leagues', allowed, dc);

console.log('\nDRAW-NO-BET (pushes excluded)');
compare('All leagues', all, dnb);
compare('App-allowed leagues', allowed, dnb);

console.log('\nBRIER SCORE (lower is better — rewards honest probabilities, not just picks)');
console.log(`  All leagues                model ${brier(all, 'model').toFixed(4)}   blend ${brier(all, 'blend').toFixed(4)}   BOOKMAKER ${brier(all, 'market').toFixed(4)}`);
console.log(`  App-allowed leagues        model ${brier(allowed, 'model').toFixed(4)}   blend ${brier(allowed, 'blend').toFixed(4)}   BOOKMAKER ${brier(allowed, 'market').toFixed(4)}`);

// The gap lives entirely in the fixtures where we disagree with the price.
console.log('\nWHERE THE GAP COMES FROM');
for (const [label, list] of [['All leagues', all], ['App-allowed', allowed]]) {
  const agree = list.filter(r => argmax(r.model) === argmax(r.market));
  const disagree = list.filter(r => argmax(r.model) !== argmax(r.market));
  let mw = 0, kw = 0, nw = 0;
  for (const r of disagree) {
    if (OUT[argmax(r.model)] === r.actual) mw++;
    else if (OUT[argmax(r.market)] === r.actual) kw++;
    else nw++;
  }
  console.log(`  ${label}:`);
  console.log(`    agree with the price   n=${String(agree.length).padStart(4)} (${(agree.length / list.length * 100).toFixed(0)}%)  hit ${hit(agree, 'model').s}`);
  console.log(`    disagree               n=${String(disagree.length).padStart(4)} (${(disagree.length / list.length * 100).toFixed(0)}%)  we were right ${pct(mw, disagree.length)}  bookmaker right ${pct(kw, disagree.length)}  both wrong ${pct(nw, disagree.length)}`);
}

// Whose opinion is the app actually showing?
console.log('\nIS THE DISPLAYED PICK OURS, OR THE BOOKMAKER\'S?');
console.log(`  blend pick matches the bookmaker favourite: ${pct(all.filter(r => argmax(r.blend) === argmax(r.market)).length, all.length)}`);
console.log(`  blend pick matches our own model:          ${pct(all.filter(r => argmax(r.blend) === argmax(r.model)).length, all.length)}`);
const confRows = all.filter(r => Math.max(...r.blend) >= 0.6);
console.log(`  on displayed picks >=60% (n=${confRows.length}), matches bookmaker: ${pct(confRows.filter(r => argmax(r.blend) === argmax(r.market)).length, confRows.length)}`);

// Calibration: a stated confidence you can stake against.
console.log('\nCALIBRATION — does a stated confidence deliver?');
for (const [key, title] of [['model', 'model alone'], ['blend', 'live blend (what the app shows)']]) {
  console.log(`  ${title}:`);
  console.log('    band        games   claimed   ACTUAL    bookmaker same games');
  for (const [lo, hi] of [[0.4, 0.5], [0.5, 0.6], [0.6, 0.65], [0.65, 0.72], [0.72, 1.01]]) {
    const seg = all.filter(r => { const m = Math.max(...r[key]); return m >= lo && m < hi; });
    if (seg.length < 20) continue;
    const claimed = seg.reduce((s, r) => s + Math.max(...r[key]), 0) / seg.length * 100;
    console.log(`    ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`.padEnd(16) + `${String(seg.length).padStart(5)}   ${claimed.toFixed(1)}%    ${hit(seg, key).s.padStart(6)}    ${hit(seg, 'market').s.padStart(6)}`);
  }
}

console.log('\nDRAWS');
const drawsActual = all.filter(r => r.actual === 'DRAW').length;
const modelDraws = all.filter(r => argmax(r.model) === 1);
console.log(`  draws occurred               ${pct(drawsActual, all.length)} of ${all.length} games`);
console.log(`  we predicted a draw          ${modelDraws.length} times, right ${pct(modelDraws.filter(r => r.actual === 'DRAW').length, modelDraws.length)}`);
console.log(`  draws as a share of our 1X2 misses: ${pct(all.filter(r => r.actual === 'DRAW' && argmax(r.model) !== 1).length, all.filter(r => OUT[argmax(r.model)] !== r.actual).length)}`);

console.log('\nPER-LEAGUE (1X2, n>=60, worst gap first)');
const byLeague = new Map();
for (const r of all) {
  if (!byLeague.has(r.league)) byLeague.set(r.league, []);
  byLeague.get(r.league).push(r);
}
const table = [...byLeague.entries()]
  .filter(([, l]) => l.length >= 60)
  .map(([name, l]) => {
    const m = hit(l, 'model'), k = hit(l, 'market');
    return { name, n: l.length, allowed: l[0].allowed, model: m.h / m.n * 100, market: k.h / k.n * 100, gap: (m.h / m.n - k.h / k.n) * 100 };
  })
  .sort((a, b) => a.gap - b.gap);
console.log('  league'.padEnd(40) + '   n    model    book     gap   in app?');
for (const t of table) {
  console.log('  ' + t.name.slice(0, 36).padEnd(38) + String(t.n).padStart(4) + '   ' + t.model.toFixed(1).padStart(5) + '%  ' + t.market.toFixed(1).padStart(5) + '%  ' + ((t.gap >= 0 ? '+' : '') + t.gap.toFixed(1)).padStart(6) + '   ' + (t.allowed ? 'yes' : 'no'));
}
const beat = table.filter(t => t.gap > 0);
console.log(`\n  Beat the bookmaker in ${beat.length} of ${table.length} leagues${beat.length ? ': ' + beat.map(t => `${t.name} (+${t.gap.toFixed(1)})`).join(', ') : ''}`);

// Competitions with no closing odds anywhere: the model runs unaided, so this is its own skill.
console.log('\nUNAIDED — competitions where we hold no odds at all');
const unaided = test.filter(m => !oddsById[m.id]);
const byU = new Map();
for (const m of unaided) {
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
  const actual = m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW';
  const okLeague = !isLeagueBlacklisted(m.league) && !engine.isLeagueDisabled(m.league);
  if (!byU.has(m.league)) byU.set(m.league, { n: 0, h: 0, allowed: okLeague });
  const e = byU.get(m.league);
  e.n++;
  if (OUT[argmax([p.home, p.draw, p.away])] === actual) e.h++;
}
const utbl = [...byU.entries()].filter(([, e]) => e.n >= 40).sort((a, b) => a[1].h / a[1].n - b[1].h / b[1].n);
for (const [name, e] of utbl) {
  console.log('  ' + name.slice(0, 36).padEnd(38) + String(e.n).padStart(4) + '   hit ' + pct(e.h, e.n).padStart(6) + '   in app? ' + (e.allowed ? 'yes' : 'no'));
}
console.log(`  (${unaided.length} of ${test.length} holdout fixtures have no closing odds; every cup and international competition is in here.)`);

console.log('\nAPP SMART-MARKET PICKS (app-allowed leagues, pushes excluded)');
const settleHit = (pick, actual) => {
  if (pick === 'HOME' || pick === 'AWAY') return actual === pick;
  if (pick === '1X') return actual === 'HOME' || actual === 'DRAW';
  if (pick === 'X2') return actual === 'AWAY' || actual === 'DRAW';
  if (pick === 'HOME_DNB') return actual === 'DRAW' ? null : actual === 'HOME';
  if (pick === 'AWAY_DNB') return actual === 'DRAW' ? null : actual === 'AWAY';
  return undefined; // goals markets are not 1X2 and are not graded here
};
const buckets = new Map();
for (const r of allowed) {
  const pick = r.smart?.pick || 'PASS';
  if (!buckets.has(pick)) buckets.set(pick, []);
  buckets.get(pick).push(r);
}
for (const [pick, list] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
  let h = 0, n = 0, push = 0;
  for (const r of list) {
    const s = settleHit(pick, r.actual);
    if (s === undefined) continue;
    if (s === null) { push++; continue; }
    n++;
    if (s) h++;
  }
  console.log(`  ${pick.padEnd(12)} ${String(list.length).padStart(5)} picks   hit ${pct(h, n).padStart(6)}${push ? `   (${push} pushes)` : ''}`);
}
console.log('\nA high hit rate here is not an edge on its own: 1X and X2 are priced around 1.2-1.4, which');
console.log('needs roughly 75-83% just to break even. Read it beside the bookmaker columns above.');
process.exit(0);
