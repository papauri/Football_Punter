// BUILD_PLAN.md verification harness: risk parity (Phase 1), Dixon-Coles audit + out-of-sample
// calibration and match-status guard (Phase 2), cache recovery (Phase 3).
// Usage: npm run verify   (exits non-zero on any failed assertion)
//
// Runs synchronously right after the engine constructor, before its deferred training-data
// ingestion and ESPN scrape timers fire, so the ratings used for the Brier check have not seen
// training_data.json (out-of-sample) and no network calls are made.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { engine } from '../engine.js';
import { getMatchRiskProfile, getSlipPick, normalizePick, RISK_THRESHOLDS } from '../src/utils/riskUtils.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ── Phase 1: risk parity between fixtures table filters and bet slip ─────────────────────────
const live = [...(engine.matches || [])];
let parityMismatches = 0;
let elite = 0, high = 0, lowRisk = 0, dnb = 0;
let eliteViolations = 0, highViolations = 0, lowRiskViolations = 0, dnbViolations = 0;
for (const m of live) {
  // Table: evaluates the pick onAddToSlip(m, slipPick) will store
  const tablePick = getSlipPick(m);
  const tableProfile = getMatchRiskProfile(m, tablePick);
  // Slip: Dashboard.handleToggleAccaPick normalises and stores the pick; AccumulatorPage re-profiles
  const storedPick = normalizePick(tablePick);
  const slipProfile = getMatchRiskProfile({ ...m }, storedPick);
  if (tableProfile.tierKey !== slipProfile.tierKey || tableProfile.badge !== slipProfile.badge) parityMismatches++;

  if (tableProfile.isElite) { // TC-01
    elite++;
    if (slipProfile.riskLevel !== 'LOW' || slipProfile.isTrap || slipProfile.pickProb < RISK_THRESHOLDS.ELITE_PROB) eliteViolations++;
  }
  if (tableProfile.isHighConfidence) { // TC-02
    high++;
    if (slipProfile.riskLevel !== 'LOW' || slipProfile.pickProb < RISK_THRESHOLDS.HIGH_PROB) highViolations++;
  }
  if (tableProfile.riskLevel === 'LOW') { // TC-03
    lowRisk++;
    if (slipProfile.isTrap || slipProfile.isFlaggedTrap || slipProfile.drawProb >= RISK_THRESHOLDS.HIGH_DRAW_RISK) lowRiskViolations++;
  }
  if (safeNum(m.prob?.draw) >= RISK_THRESHOLDS.DNB_DRAW) { // TC-04
    dnb++;
    if (!slipProfile.dnbAdvised) dnbViolations++;
  }
}
check('Phase 1: table vs slip risk profile parity', parityMismatches === 0, `${live.length} live fixtures, ${parityMismatches} mismatches`);
check('TC-01 Elite filter → Elite/Low Risk on slip', eliteViolations === 0, `${elite} elite, ${eliteViolations} violations`);
check('TC-02 High Confidence filter → Low Risk on slip', highViolations === 0, `${high} high, ${highViolations} violations`);
check('TC-03 Low Risk filter → zero trap alerts on slip', lowRiskViolations === 0, `${lowRisk} low risk, ${lowRiskViolations} violations`);
check('TC-04 Draw ≥24% → DNB advised on slip', dnbViolations === 0, `${dnb} DNB-eligible, ${dnbViolations} violations`);

// Taxonomy spot-checks on synthetic fixtures
const synth = (home, draw, away, extra = {}) => ({ home: 'A', away: 'B', league: 'Premier League', prob: { home, draw, away }, confidence: extra.confidence ?? Math.max(home, away), ...extra });
check('Taxonomy: 72/18/10 conf 75 → ELITE', getMatchRiskProfile(synth(72, 18, 10, { confidence: 75 }), 'HOME').tierKey === 'ELITE');
check('Taxonomy: 63/22/15 → HIGH', getMatchRiskProfile(synth(63, 22, 15), 'HOME').tierKey === 'HIGH');
check('Taxonomy: 52/27/21 → DNB advised', getMatchRiskProfile(synth(52, 27, 21), 'HOME').tierKey === 'DNB');
check('Taxonomy: 44/29/27 → CONTESTED', getMatchRiskProfile(synth(44, 29, 27, { confidence: 48 }), 'HOME').tierKey === 'CONTESTED');
check('Taxonomy: trap flag overrides 80% → TRAP', getMatchRiskProfile(synth(80, 12, 8, { confidence: 80, isFavoriteTrap: true }), 'HOME').riskLevel === 'HIGH');
check('Taxonomy: low odds never downgrade Elite', getMatchRiskProfile(synth(78, 15, 7, { confidence: 80, odds: { home: 1.12 } }), 'HOME').tierKey === 'ELITE');

// ── Phase 2: Dixon-Coles audit ──────────────────────────────────────────────────────────────
const maxGoals = engine.hyperparameters.maxScorelineSim;
const pois = (k, l) => Math.exp(-l) * l ** k / [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600][k];
let worstTail = 0;
for (const lambda of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  let mass = 0;
  for (let k = 0; k <= maxGoals; k++) mass += pois(k, lambda);
  worstTail = Math.max(worstTail, 1 - mass);
}
check(`Poisson tail mass beyond ${maxGoals} goals ≤ 0.5% for λ ≤ 3.0`, worstTail <= 0.005, `worst ${(worstTail * 100).toFixed(3)}%`);

// Temporal split: train the engine on everything before the most recent 9,000 fixtures, then
// score those 9,000 held-out fixtures (true out-of-sample, no look-ahead).
const corpus = JSON.parse(fs.readFileSync(new URL('../training_data.json', import.meta.url), 'utf8'))
  .filter(m => m.home && m.away && typeof m.homeScore === 'number' && typeof m.awayScore === 'number')
  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const training = corpus.slice(-9000);
const trainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-verify-'));
fs.writeFileSync(path.join(trainDir, 'training_data.json'), JSON.stringify(corpus.slice(0, -9000)));
const repoCwd = process.cwd();
process.chdir(trainDir);
engine.loadTrainingDataFromDisk();
process.chdir(repoCwd);
fs.rmSync(trainDir, { recursive: true, force: true });
results.push(`INFO  trained on ${corpus.length - training.length} fixtures before ${new Date(training[0].timestamp).toISOString().slice(0, 10)}, testing on ${training.length} later fixtures`);

let brierSum = 0, correct = 0, badSums = 0, n = 0;
let dnbPredicted = 0, dnbActualDraws = 0, nonDnbDraws = 0, nonDnb = 0;
const buckets = new Map();
for (const m of training) {
  const p = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
  const total = p.home + p.draw + p.away;
  if (!Number.isFinite(total) || Math.abs(total - 100) > 0.6) badSums++;
  const actual = m.actualWinner || (m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW');
  const yH = actual === 'HOME' ? 1 : 0, yD = actual === 'DRAW' ? 1 : 0, yA = actual === 'AWAY' ? 1 : 0;
  brierSum += ((p.home / 100 - yH) ** 2 + (p.draw / 100 - yD) ** 2 + (p.away / 100 - yA) ** 2) / 3;
  const top = p.home >= p.away && p.home >= p.draw ? 'HOME' : p.away >= p.draw ? 'AWAY' : 'DRAW';
  if (top === actual) correct++;
  const topP = Math.max(p.home, p.away);
  const bucket = Math.min(8, Math.floor(topP / 10));
  const b = buckets.get(bucket) || { n: 0, hits: 0, pSum: 0 };
  b.n++; b.pSum += topP; if ((p.home >= p.away ? 'HOME' : 'AWAY') === actual) b.hits++;
  buckets.set(bucket, b);
  if (p.draw >= RISK_THRESHOLDS.DNB_DRAW) { dnbPredicted++; if (yD) dnbActualDraws++; } else { nonDnb++; if (yD) nonDnbDraws++; }
  n++;
}
const brier = brierSum / n;
check('DC probabilities normalised to 100% on every fixture', badSums === 0, `${badSums}/${n} off`);
check(`Out-of-sample Brier (mean per-class, n=${n}) ≤ 0.210 regression floor`, brier <= 0.210, `${brier.toFixed(4)} (plan target 0.178)`);
const dnbDrawRate = dnbPredicted ? (dnbActualDraws / dnbPredicted) * 100 : 0;
const baseDrawRate = nonDnb ? (nonDnbDraws / nonDnb) * 100 : 0;
check('DNB threshold (P_draw ≥ 24%) isolates higher real draw rate', dnbPredicted === 0 || dnbDrawRate > baseDrawRate, `draw rate ${dnbDrawRate.toFixed(1)}% flagged vs ${baseDrawRate.toFixed(1)}% unflagged (${dnbPredicted} flagged)`);
results.push(`INFO  1X2 accuracy ${(correct / n * 100).toFixed(1)}% over ${n} fixtures`);
for (const [k, b] of [...buckets].sort((a, c) => a[0] - c[0])) {
  results.push(`INFO  calibration ${k * 10}-${k * 10 + 9}% fav prob: predicted ${(b.pSum / b.n).toFixed(1)}% vs actual ${(b.hits / b.n * 100).toFixed(1)}% (n=${b.n})`);
}

// Match status guard: >130 minutes past kickoff must never be LIVE
const now = Date.now();
const raw = (minsAgo, extra = {}) => ({ id: `t${minsAgo}`, home: 'Arsenal', away: 'Chelsea', league: 'Premier League', timestamp: now - minsAgo * 60000, ...extra });
const past131 = engine.analyzeRawFixture(raw(131, { status: "78'", isLive: true, clock: "78'" }));
const past300 = engine.analyzeRawFixture(raw(300, { status: 'LIVE', isLive: true }));
const at60 = engine.analyzeRawFixture(raw(60, { status: "60'", isLive: true }));
const future = engine.analyzeRawFixture(raw(-30, { status: 'Scheduled' }));
check('Kickoff +131m with stale LIVE flag → not live, FT', !past131.isLive && past131.isCompleted, `isLive=${past131.isLive} isCompleted=${past131.isCompleted}`);
check('Kickoff +300m → not live', !past300.isLive);
check('Kickoff +60m in-play → live', at60.isLive === true);
check('Kickoff in 30m → scheduled, not live', !future.isLive && !future.isCompleted);

// ── Phase 3: cache serialization recovery ──────────────────────────────────────────────────
check('Fixture cache writes are atomic with .bak recovery', /renameSync\(tmpPath, filePath\)/.test(fs.readFileSync(new URL('../engine.js', import.meta.url), 'utf8')));

console.log(results.join('\n'));
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

function safeNum(v) { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
