// Forward test of specific betting hypotheses, registered before the fixtures they are judged on.
// Usage: npm run hypotheses
//        npm run hypotheses -- --historical <bets.json>   (score the same rules on a walk-forward bet log)
//
// WHY A SEPARATE TEST
//
// The walk-forward reported two markets with positive returns: AWAY picks and HOME_DNB picks. They
// were found by looking at six markets after the fact, so at least one of them was likely to look
// good by chance. The only fair judge is fixtures that had not been played when the rules were
// written down. data/hypotheses.json fixes, before any of those fixtures exist:
//
//   * the rule           which published pick counts (the frozen model's smart pick, nothing else)
//   * the price          the pre-kickoff quote frozen in data/early_picks.json, 6-96h before kickoff
//   * the scope          the leagues the historical estimate came from (other leagues reported apart)
//   * the model          the freeze generation; picks made by any other version are ignored
//   * the decision rule  when to abandon, and the single point at which to judge
//
// Interim looks can only abandon a hypothesis, never confirm one: looking repeatedly and stopping on
// a good run is the most common way a forward test turns into another backtest.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootstrapRoi } from '../src/model/bootstrap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const readJson = (p, fallback) => {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; } catch { return fallback; }
};
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : Number(x).toFixed(d));
const argOf = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? null : process.argv[i + 1]; };

const reg = readJson('data/hypotheses.json', null);
if (!reg) {
  console.log('No hypotheses registered (data/hypotheses.json is missing).');
  process.exit(0);
}

// ---- settlement, identical to scripts/walk-forward.mjs -----------------------------------------
const dnbPrice = (side, other) => (1 / side + 1 / other) / (1 / side);
function priceFor(pick, q) {
  const h = Number(q?.home), d = Number(q?.draw), a = Number(q?.away);
  if (!(h > 1 && d > 1 && a > 1)) return null;
  if (pick === 'AWAY') return a;
  if (pick === 'HOME_DNB') return dnbPrice(h, a);
  return null;
}
function settle(pick, price, actual) {
  if (pick === 'AWAY') return actual === 'AWAY' ? price : 0;
  if (pick === 'HOME_DNB') return actual === 'DRAW' ? 1 : actual === 'HOME' ? price : 0;
  return null;
}

function summarise(bets) {
  const n = bets.length;
  if (!n) return { n: 0 };
  const rs = bets.map(b => b.r);
  const pushes = rs.filter(r => r === 1).length;
  const won = rs.filter(r => r > 1).length;
  const boot = n >= 2 ? bootstrapRoi(rs) : null;
  return {
    n, won, pushes,
    hit: won / Math.max(1, n - pushes) * 100,
    avgPrice: bets.reduce((s, b) => s + b.price, 0) / n,
    roi: (rs.reduce((a, b) => a + b, 0) - n) / n * 100,
    lo: boot?.lo, hi: boot?.hi
  };
}

function verdict(h, s) {
  const rule = reg.decision;
  if (!s.n) return 'COLLECTING — no qualifying bets yet';
  if (s.n >= rule.abandonAfterBets && s.hi != null && s.hi < 0) {
    return `ABANDON — the whole 95% interval is below zero after ${s.n} bets`;
  }
  if (s.n >= rule.judgeAtBets) {
    return s.lo > 0
      ? `SUPPORTED at ${rule.judgeAtBets} bets — interval above zero. Still one test: stake small and keep measuring.`
      : `NOT SUPPORTED at ${rule.judgeAtBets} bets — interval includes zero or worse. Retire it.`;
  }
  return `COLLECTING — ${s.n} of ${rule.judgeAtBets} bets. Interim looks may abandon, never confirm.`;
}

function printBlock(title, groups) {
  console.log(`\n${title}`);
  console.log('  hypothesis  bets  won  push   hit%   avg price     ROI     95% CI');
  for (const h of reg.hypotheses) {
    const s = summarise(groups[h.id] || []);
    if (!s.n) { console.log(`  ${h.id.padEnd(10)}  ${'0'.padStart(4)}`); continue; }
    console.log(
      `  ${h.id.padEnd(10)}  ${String(s.n).padStart(4)} ${String(s.won).padStart(4)} ${String(s.pushes).padStart(5)}` +
      `  ${f(s.hit, 1).padStart(5)}   ${f(s.avgPrice).padStart(9)}  ${f(s.roi).padStart(6)}%   [${f(s.lo)}, ${f(s.hi)}]`
    );
  }
}

const coreLeagues = new Set(reg.scope.leagues);

// ---- historical mode: the same rules on a walk-forward bet log ---------------------------------
const historical = argOf('historical');
if (historical) {
  const log = readJson(historical, null);
  if (!log?.bets) { console.log(`No bet log at ${historical}. Create one with: npm run walkforward -- --bets-out <file>`); process.exit(1); }
  const priceKey = process.argv.includes('--best') ? 'priceBest' : 'priceAvg';
  const core = {}, other = {};
  for (const b of log.bets) {
    if (!reg.hypotheses.some(h => h.id === b.pick)) continue;
    const price = b[priceKey];
    const r = settle(b.pick, price, b.actual);
    if (r == null) continue;
    const bucket = coreLeagues.has(b.league) ? core : other;
    (bucket[b.pick] ||= []).push({ price, r });
  }
  console.log(`HISTORICAL CHECK — walk-forward ${log.window.from} .. ${log.window.to}, ${priceKey === 'priceBest' ? 'best' : 'average'} opening price`);
  printBlock('Registered leagues', core);
  if (Object.keys(other).length) printBlock('Other leagues (not part of the test)', other);
  process.exit(0);
}

// ---- forward mode ------------------------------------------------------------------------------
const registeredTs = Date.parse(reg.registeredAt);
console.log(`FORWARD HYPOTHESIS TEST — registered ${reg.registeredAt.slice(0, 16)}Z, model generation ${reg.modelGeneration}`);

const freeze = readJson('data/model-freeze.json', null);
if (!freeze) {
  console.log('\n*** No model freeze on disk. Picks from an unfrozen model do not count. ***');
} else if (freeze.generation !== reg.modelGeneration) {
  console.log(`\n*** The model on disk is generation ${freeze.generation}, not ${reg.modelGeneration}. ***`);
  console.log('New picks will not count towards this test. Either restore the registered model, or register a');
  console.log('fresh test for the new one (its record starts from zero).');
} else {
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
  const changed = Object.entries(freeze.hashes || {}).filter(([p, h]) => !fs.existsSync(p) || sha(p) !== h).map(([p]) => p);
  if (changed.length) {
    console.log(`\n*** Model files changed since the freeze (${changed.join(', ')}). ***`);
    console.log('Picks recorded from now on belong to a different model. Re-freeze and re-register.');
  }
}

// Results: the ledger first, then the fixture cache, then the training corpus.
const results = new Map();
const put = (id, w) => { if (id != null && w && !results.has(String(id))) results.set(String(id), w); };
const winnerOf = (m) => m.actualWinner || (typeof m.homeScore === 'number' && typeof m.awayScore === 'number'
  ? (m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW') : null);
for (const e of readJson('pre_kickoff_ledger.json', [])) put(e.id, e.actualWinner);
const cache = readJson('fixtures_cache.json', {});
for (const key of ['matches', 'yesterdayMatches', 'todayCompletedMatches']) {
  for (const m of cache[key] || []) if (m.isCompleted) put(m.id, winnerOf(m));
}
for (const m of readJson('training_data.json', [])) put(m.id, winnerOf(m));

const early = readJson('data/early_picks.json', {});
const oddsHistory = readJson('data/odds_history.json', {});
const core = {}, other = {};
let excludedGeneration = 0, excludedBeforeRegistration = 0, pending = 0, noPrice = 0;
const clv = [];

for (const [id, e] of Object.entries(early)) {
  const pick = e.smartPick;
  if (!reg.hypotheses.some(h => h.id === pick)) continue;
  if (Date.parse(e.at) < registeredTs || Date.parse(e.kickoffUtc) < registeredTs) { excludedBeforeRegistration++; continue; }
  if (e.modelGeneration !== reg.modelGeneration) { excludedGeneration++; continue; }
  const price = priceFor(pick, e.quotedPrice || e.priceTaken);
  if (price == null) { noPrice++; continue; }
  const actual = results.get(String(id));
  if (!actual) { pending++; continue; }
  const r = settle(pick, price, actual);
  const bucket = coreLeagues.has(e.league) ? core : other;
  (bucket[pick] ||= []).push({ price, r, league: e.league });

  // Closing-line value against the same provider's last quote within the close window, as a diagnostic.
  const provider = (e.quotedPrice || e.priceTaken)?.provider ?? null;
  const series = (oddsHistory[id] || []).filter(o => (o.provider ?? null) === provider);
  const last = series[series.length - 1];
  const minutesOut = last ? (last.lastSeenMinutesBeforeKickoff ?? last.minutesBeforeKickoff) : null;
  const closePrice = last && minutesOut <= reg.scope.closeWindowMinutes ? priceFor(pick, last) : null;
  if (closePrice && coreLeagues.has(e.league)) clv.push((price / closePrice - 1) * 100);
}

printBlock('REGISTERED LEAGUES — this is the test', core);
console.log('\n  Verdicts (decision rule fixed at registration):');
for (const h of reg.hypotheses) console.log(`    ${h.id.padEnd(10)} ${verdict(h, summarise(core[h.id] || []))}`);
if (Object.keys(other).length) printBlock('OTHER LEAGUES — reported for interest, not part of the test', other);

console.log('\n  For comparison, what the historical walk-forward estimated (average price, the one the app records):');
for (const h of reg.hypotheses) {
  const e = h.historical;
  console.log(`    ${h.id.padEnd(10)} ${e.bets} bets, ROI ${f(e.roiAvg)}% [${f(e.ciAvg[0])}, ${f(e.ciAvg[1])}]  (${e.window})`);
  const rp = h.replication;
  if (rp) console.log(`    ${''.padEnd(10)} ${rp.bets} bets, ROI ${f(rp.roiAvg)}% [${f(rp.ciAvg[0])}, ${f(rp.ciAvg[1])}]  (${rp.window})`);
}

if (clv.length) {
  const mean = clv.reduce((a, b) => a + b, 0) / clv.length;
  console.log(`\n  Closing-line value on ${clv.length} of these picks: mean ${f(mean)}%, beat the close on ${f(clv.filter(x => x > 0).length / clv.length * 100, 1)}%.`);
  console.log('  A diagnostic of timing only; it is not part of the decision rule.');
}

console.log(`\n  Not counted: ${pending} awaiting a result, ${excludedGeneration} made by a different model version,`);
console.log(`  ${excludedBeforeRegistration} recorded before registration, ${noPrice} without a usable price.`);
console.log('\n  Prices are quotes observed 6-96h before kickoff, not confirmed bets. Whether the price was');
console.log('  actually available, and at what stake, is not known.');
process.exit(0);
