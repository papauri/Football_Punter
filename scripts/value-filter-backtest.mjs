// Does the smart-market value filter (hyperparameter valueEdgeThreshold) improve returns?
// Usage: npm run value:backtest
//
// Same temporal split as odds-backtest.mjs: train on fixtures before the most recent 9,000, score
// those out-of-sample. Only leagues the engine allows; closing odds are fed to the engine as the live
// app feeds ESPN odds. Every non-pass smart pick is staked 1 unit at its closing price (DC and DNB
// prices derived from the 1X2 odds). The threshold is chosen on the first half of the window and
// reported on the second half, so the reported figures never see their own tuning.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const { engine } = await import('../engine.js');
const { isLeagueBlacklisted } = await import('../src/utils/leagueUtils.js');

const corpus = JSON.parse(fs.readFileSync('training_data.json', 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const oddsById = JSON.parse(fs.readFileSync('data/historical_odds.json', 'utf8')).odds;
const test = corpus.slice(-9000);

const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-value-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(corpus.slice(0, -9000)));
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(ROOT);
fs.rmSync(trainDir, { recursive: true, force: true });

const fixtures = test
  .filter(m => oddsById[m.id] && !isLeagueBlacklisted(m.league) && !engine.isLeagueDisabled(m.league))
  .map(m => {
    const o = oddsById[m.id];
    const inv = [1 / o.h, 1 / o.d, 1 / o.a];
    const book = inv[0] + inv[1] + inv[2];
    return {
      m,
      odds: {
        homeOdds: o.h, drawOdds: o.d, awayOdds: o.a,
        homeProb: inv[0] / book * 100, drawProb: inv[1] / book * 100, awayProb: inv[2] / book * 100,
        marketFav: inv[0] >= inv[2] ? 'HOME' : 'AWAY'
      }
    };
  });

// Return per 1-unit stake for a smart pick at the engine's own quoted price (0 = lost, 1 = DNB push)
function settle(pick, price, hs, as) {
  const home = hs > as, draw = hs === as, away = as > hs;
  if (pick === 'HOME') return home ? price : 0;
  if (pick === 'AWAY') return away ? price : 0;
  if (pick === '1X') return home || draw ? price : 0;
  if (pick === 'X2') return away || draw ? price : 0;
  if (pick === 'HOME_DNB') return draw ? 1 : home ? price : 0;
  if (pick === 'AWAY_DNB') return draw ? 1 : away ? price : 0;
  return null; // goals markets: no historical odds to price them
}

function run(threshold, list) {
  engine.hyperparameters.valueEdgeThreshold = threshold;
  let bets = 0, wins = 0, returned = 0;
  for (const { m, odds } of list) {
    const sm = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, odds }).smartMarket;
    if (sm.pick === 'PASS' || !sm.valueCheck) continue;
    const r = settle(sm.pick, sm.valueCheck.odds, m.homeScore, m.awayScore);
    if (r == null) continue;
    bets++;
    returned += r;
    if (r > 1) wins++;
  }
  return { bets, hitRate: bets ? wins / bets * 100 : null, roi: bets ? (returned - bets) / bets * 100 : null };
}

const original = engine.hyperparameters.valueEdgeThreshold;
const half = Math.floor(fixtures.length / 2);
const tune = fixtures.slice(0, half), holdout = fixtures.slice(half);
const fmt = (s) => `${String(s.bets).padStart(5)} bets  hit ${s.hitRate == null ? '—' : s.hitRate.toFixed(1) + '%'}  ROI ${s.roi == null ? '—' : s.roi.toFixed(1) + '%'}`;
const label = (t) => (t == null ? 'off' : `EV > ${(t * 100).toFixed(0)}%`).padEnd(10);

console.log(`Allowed-league fixtures with closing odds: ${fixtures.length} (tune ${tune.length}, holdout ${holdout.length})`);
console.log('\nTUNE WINDOW');
let best = null, bestRoi = -Infinity;
for (const t of [null, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05]) {
  const s = run(t, tune);
  console.log(`  ${label(t)} ${fmt(s)}`);
  if (s.bets >= 50 && s.roi > bestRoi) { bestRoi = s.roi; best = t; }
}
console.log(`\nHOLDOUT (never used for tuning)`);
console.log(`  ${label(null)} ${fmt(run(null, holdout))}   ← no filter`);
console.log(`  ${label(best)} ${fmt(run(best, holdout))}   ← best threshold from tune window`);
console.log(`  ${label(0)} ${fmt(run(0, holdout))}   ← any positive model EV`);
engine.hyperparameters.valueEdgeThreshold = original;
process.exit(0);
