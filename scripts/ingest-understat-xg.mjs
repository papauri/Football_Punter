// Ingest per-fixture expected goals from understat and match them to our training fixtures.
// Usage: npm run xg:ingest [-- --from 2019 --to 2025 --refresh]
//
// Why xG. Goals are a noisy measure of how well a side played: finishing swings hard over a handful
// of shots, so a team's goal record over 20 games still carries a lot of luck. xG measures chances
// created and conceded, which is far more stable game to game and therefore a better basis for the
// strength fit. This is the largest single improvement available to us from public data.
//
// Coverage. understat carries the top five European leagues plus the Russian top flight, and nothing
// else. Roughly a third of our fixtures with closing odds fall in those leagues, so this lifts the
// segment that matters most for checking ourselves against a price, and leaves the rest untouched.
//
// Matching. understat has its own fixture and team ids, unrelated to the ESPN ids our corpus uses, so
// fixtures are matched on kickoff date (+/- 1 day, for timezone differences) plus both team names
// after normalisation. Requiring BOTH teams to agree within a two-day window makes a false match
// very unlikely, and anything ambiguous is dropped and reported rather than guessed at.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? fallback : v;
};
const FROM = parseInt(arg('from', '2019'), 10);
const TO = parseInt(arg('to', String(new Date().getUTCFullYear())), 10);
const REFRESH = process.argv.includes('--refresh');

const LEAGUES = ['EPL', 'La_liga', 'Bundesliga', 'Serie_A', 'Ligue_1', 'RFPL'];
const CACHE_DIR = path.join(ROOT, 'data', 'understat_cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

// ---- team name normalisation -------------------------------------------------------------------
// understat and ESPN disagree on plenty of names ("Tottenham" vs "Tottenham Hotspur", "Wolverhampton
// Wanderers" vs "Wolverhampton"). Normalising strips the parts that vary; the alias table below
// handles the cases normalisation cannot reach.
const ALIASES = {
  'manchester city': 'man city',
  'manchester united': 'man utd',
  'manchester utd': 'man utd',
  'tottenham': 'tottenham',
  'tottenham hotspur': 'tottenham',
  'wolverhampton wanderers': 'wolves',
  'wolverhampton': 'wolves',
  'newcastle united': 'newcastle',
  'west ham united': 'west ham',
  'leeds united': 'leeds',
  'leicester city': 'leicester',
  'norwich city': 'norwich',
  'cardiff city': 'cardiff',
  'swansea city': 'swansea',
  'stoke city': 'stoke',
  'hull city': 'hull',
  'birmingham city': 'birmingham',
  'brighton': 'brighton',
  'brighton hove albion': 'brighton',
  'brighton and hove albion': 'brighton',
  'sheffield united': 'sheffield utd',
  'sheffield wednesday': 'sheffield wed',
  'nottingham forest': 'nottm forest',
  'queens park rangers': 'qpr',
  'paris saint germain': 'psg',
  'paris saint-germain': 'psg',
  'olympique lyonnais': 'lyon',
  'olympique de marseille': 'marseille',
  'olympique marseille': 'marseille',
  'as monaco': 'monaco',
  'saint etienne': 'st etienne',
  'atletico madrid': 'atletico madrid',
  'athletic club': 'athletic bilbao',
  'athletic bilbao': 'athletic bilbao',
  'real betis': 'betis',
  'real sociedad': 'real sociedad',
  'celta vigo': 'celta vigo',
  'rc celta de vigo': 'celta vigo',
  'deportivo alaves': 'alaves',
  'real valladolid': 'valladolid',
  'rayo vallecano': 'rayo vallecano',
  'bayern munich': 'bayern munich',
  'bayern muenchen': 'bayern munich',
  'borussia dortmund': 'dortmund',
  'borussia m gladbach': 'gladbach',
  'borussia monchengladbach': 'gladbach',
  'bayer leverkusen': 'leverkusen',
  'rasenballsport leipzig': 'rb leipzig',
  'rb leipzig': 'rb leipzig',
  'schalke 004': 'schalke',
  'schalke 04': 'schalke',
  'eintracht frankfurt': 'frankfurt',
  'vfb stuttgart': 'stuttgart',
  'werder bremen': 'werder bremen',
  'fc koln': 'koln',
  'koeln': 'koln',
  'hertha berlin': 'hertha',
  'internazionale': 'inter milan',
  'inter': 'inter milan',
  'ac milan': 'ac milan',
  'milan': 'ac milan',
  'juventus': 'juventus',
  'napoli': 'napoli',
  'as roma': 'roma',
  'hellas verona': 'verona',
  'verona': 'verona',
  // France
  'stade rennais': 'rennes',
  'rennes': 'rennes',
  'stade reims': 'reims',
  'reims': 'reims',
  'stade brestois 29': 'brest',
  'brest': 'brest',
  'nimes olympique': 'nimes',
  'losc lille': 'lille',
  'lille': 'lille',
  'toulouse': 'toulouse',
  'clermont foot': 'clermont',
  'angers sco': 'angers',
  'fco dijon': 'dijon',
  'dijon': 'dijon',
  // Germany
  '1 union berlin': 'union berlin',
  'union berlin': 'union berlin',
  'spvgg greuther furth': 'greuther fuerth',
  'greuther furth': 'greuther fuerth',
  'greuther fuerth': 'greuther fuerth',
  'mainz 05': 'mainz',
  'mainz': 'mainz',
  'borussia m gladbach': 'gladbach',
  'monchengladbach': 'gladbach',
  'moenchengladbach': 'gladbach',
  'arminia bielefeld': 'bielefeld',
  'bielefeld': 'bielefeld',
  'bochum': 'bochum',
  'darmstadt 98': 'darmstadt',
  'heidenheim 1846': 'heidenheim',
  'heidenheim': 'heidenheim',
  'hoffenheim': 'hoffenheim',
  'st pauli': 'st pauli',
  'holstein kiel': 'holstein kiel',
  // England
  'luton town': 'luton',
  'luton': 'luton',
  'ipswich town': 'ipswich',
  'ipswich': 'ipswich',
  // Italy
  'parma 1913': 'parma',
  'parma': 'parma',
  'spezia': 'spezia',
  // Spain
  'racing santander': 'racing santander',
  'real oviedo': 'oviedo',
  'levante': 'levante'
};

function normaliseTeam(name) {
  let s = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop corporate and club-type tokens that one source writes and the other does not.
  s = s.replace(/\b(fc|afc|cf|ac|as|sc|ssc|ss|us|ud|cd|rc|rcd|sv|vfl|vfb|tsg|fsv|bsc|1899|calcio|club|de|di|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[s] || s;
}

// ---- fetch -------------------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchLeagueSeason(league, season) {
  const cacheFile = path.join(CACHE_DIR, `${league}-${season}.json`);
  if (!REFRESH && fs.existsSync(cacheFile)) {
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (_) { /* refetch below */ }
  }
  const url = `https://understat.com/getLeagueData/${league}/${season}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://understat.com/league/${league}/${season}`,
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.dates)) throw new Error('no dates array in response');
      fs.writeFileSync(cacheFile, JSON.stringify(data));
      return data;
    } catch (e) {
      if (attempt === 4) {
        console.warn(`  ${league} ${season}: giving up after 4 attempts (${e.message})`);
        return null;
      }
      await sleep(attempt * 1500);
    }
  }
  return null;
}

// ---- collect understat fixtures ----------------------------------------------------------------
const understatFixtures = [];
console.log(`Fetching understat seasons ${FROM}-${TO} for ${LEAGUES.length} leagues${REFRESH ? ' (refresh)' : ' (cached where available)'}\n`);
for (const league of LEAGUES) {
  let leagueCount = 0;
  for (let season = FROM; season <= TO; season++) {
    const data = await fetchLeagueSeason(league, season);
    if (!data) continue;
    for (const f of data.dates) {
      // isResult false means the fixture had not been played when the page was generated.
      if (!f.isResult) continue;
      const xgH = parseFloat(f.xG?.h), xgA = parseFloat(f.xG?.a);
      const gH = parseInt(f.goals?.h, 10), gA = parseInt(f.goals?.a, 10);
      if (!Number.isFinite(xgH) || !Number.isFinite(xgA) || !Number.isFinite(gH) || !Number.isFinite(gA)) continue;
      const day = String(f.datetime || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      understatFixtures.push({
        league, season,
        understatId: f.id,
        day,
        home: f.h?.title, away: f.a?.title,
        homeKey: normaliseTeam(f.h?.title),
        awayKey: normaliseTeam(f.a?.title),
        xgH, xgA, gH, gA
      });
      leagueCount++;
    }
    await sleep(400); // be a polite guest on someone else's server
  }
  console.log(`  ${league.padEnd(12)} ${leagueCount} played fixtures`);
}
console.log(`\nTotal understat fixtures with xG: ${understatFixtures.length}`);

// ---- match to our corpus -----------------------------------------------------------------------
const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number');

// Index understat by day so each corpus fixture only compares against a two-day window.
const byDay = new Map();
for (const f of understatFixtures) {
  if (!byDay.has(f.day)) byDay.set(f.day, []);
  byDay.get(f.day).push(f);
}
const shiftDay = (day, delta) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

const xgByFixtureId = {};
const used = new Set();
let matched = 0, scoreMismatch = 0;
const unmatchedByLeague = new Map();

for (const m of corpus) {
  const day = String(m.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
  const hKey = normaliseTeam(m.home), aKey = normaliseTeam(m.away);

  // One name often differs only by a dropped suffix ("Luton" vs "Luton Town", "Mainz" vs
  // "Mainz 05"), so exact agreement is tried first and containment is accepted as a fallback rather
  // than maintaining an alias for every such pair. The scoreline check below is what makes the
  // looser pass safe.
  const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
  let hit = null;
  for (const strict of [true, false]) {
    for (const delta of [0, -1, 1]) {
      for (const f of byDay.get(shiftDay(day, delta)) || []) {
        if (used.has(f.understatId)) continue;
        const ok = strict
          ? (f.homeKey === hKey && f.awayKey === aKey)
          : (near(f.homeKey, hKey) && near(f.awayKey, aKey));
        // Require the scoreline too, so a loose name match cannot pair the wrong fixture.
        if (ok && f.gH === m.homeScore && f.gA === m.awayScore) { hit = f; break; }
      }
      if (hit) break;
    }
    if (hit) break;
  }

  if (!hit) {
    // Only worth reporting for leagues understat actually covers.
    const key = m.league || 'Unknown';
    if (!unmatchedByLeague.has(key)) unmatchedByLeague.set(key, { count: 0, examples: [] });
    const e = unmatchedByLeague.get(key);
    e.count++;
    if (e.examples.length < 4) e.examples.push(`${m.date} ${m.home} v ${m.away}`);
    continue;
  }

  // Final guard: the scoreline must agree. A date-and-names match with a different score means we
  // have lined up the wrong fixture, so drop it rather than poison the fit.
  if (hit.gH !== m.homeScore || hit.gA !== m.awayScore) { scoreMismatch++; continue; }

  used.add(hit.understatId);
  xgByFixtureId[m.id] = {
    xgHome: parseFloat(hit.xgH.toFixed(4)),
    xgAway: parseFloat(hit.xgA.toFixed(4)),
    understatId: hit.understatId,
    source: `understat/${hit.league}/${hit.season}`
  };
  matched++;
}

// Report coverage per league, for the leagues understat covers at all.
const coverage = new Map();
for (const m of corpus) {
  const key = m.league || 'Unknown';
  if (!coverage.has(key)) coverage.set(key, { total: 0, withXg: 0 });
  const c = coverage.get(key);
  c.total++;
  if (xgByFixtureId[m.id]) c.withXg++;
}
console.log(`\nMatched ${matched} of ${corpus.length} corpus fixtures (${(matched / corpus.length * 100).toFixed(1)}%)`);
if (scoreMismatch) console.log(`Dropped ${scoreMismatch} candidate matches whose scoreline disagreed.`);

console.log('\nCoverage by league (only leagues with any xG shown):');
for (const [league, c] of [...coverage.entries()].filter(([, c]) => c.withXg > 0).sort((a, b) => b[1].withXg - a[1].withXg)) {
  console.log(`  ${league.slice(0, 30).padEnd(32)} ${String(c.withXg).padStart(5)} / ${String(c.total).padEnd(5)}  ${(c.withXg / c.total * 100).toFixed(0)}%`);
}

// Leagues where understat should have had data but coverage is poor point at a naming problem.
const suspicious = [...coverage.entries()]
  .filter(([league, c]) => c.withXg > 0 && c.withXg / c.total < 0.9)
  .map(([league, c]) => `${league} (${(c.withXg / c.total * 100).toFixed(0)}%)`);
if (suspicious.length) {
  console.log('\nPartial coverage — likely team-name mismatches worth adding to ALIASES:');
  for (const [league, e] of [...unmatchedByLeague.entries()].filter(([l]) => coverage.get(l)?.withXg > 0)) {
    console.log(`  ${league}: ${e.count} unmatched, e.g. ${e.examples.join(' | ')}`);
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  source: 'understat.com getLeagueData',
  seasons: `${FROM}-${TO}`,
  leagues: LEAGUES,
  understatFixtures: understatFixtures.length,
  corpusFixtures: corpus.length,
  matched,
  scoreMismatchDropped: scoreMismatch,
  note: 'Matched on kickoff date (+/-1 day) plus both normalised team names, with the scoreline required to agree. understat covers the top five European leagues and the Russian top flight only.',
  xg: xgByFixtureId
};
fs.writeFileSync(path.join(ROOT, 'data', 'historical_xg.json'), JSON.stringify(out));
console.log(`\nWritten to data/historical_xg.json (${matched} fixtures)`);
process.exit(0);
