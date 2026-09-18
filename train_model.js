import fs from 'fs';
import { engine } from './engine.js';

const rawData = fs.readFileSync('training_data.json', 'utf8');
const matches = JSON.parse(rawData);

console.log(`\n======================================================`);
console.log(`MACHINE LEARNING EVALUATION & HYPERPARAMETER TUNING`);
console.log(`======================================================`);
console.log(`Total Dataset Samples: ${matches.length}`);

// Chronological Train/Test Split (80% Train, 20% Test)
const splitIdx = Math.floor(matches.length * 0.80);
const trainMatches = matches.slice(0, splitIdx);
const testMatches = matches.slice(splitIdx);

console.log(`Chronological Split:`);
console.log(`  Training Set:   ${trainMatches.length} matches`);
console.log(`  Test / Eval:    ${testMatches.length} matches`);

// Grid ranges for hyperparameters
const homeAdvantageRange = [1.05, 1.10, 1.15, 1.18, 1.22, 1.25];
const homeEloBoostRange = [20, 35, 50, 60, 70, 85];
const drawEquilibriumDeltaRange = [7.5, 8.5, 9.5, 10.5, 12.0];


function evaluateSet(matchSubset) {
  let totalBrier = 0;
  let totalLogLoss = 0;
  let correct = 0;

  // Slices
  let leagueCorrect = 0, leagueTotal = 0, leagueBrier = 0;
  let cupCorrect = 0, cupTotal = 0, cupBrier = 0;

  // Outcome distribution tracking
  let homeHits = 0, totalHome = 0;
  let drawHits = 0, totalDraw = 0;
  let awayHits = 0, totalAway = 0;

  for (const m of matchSubset) {
    const actualWinner = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
    const probs = engine.computeDixonColesProbabilities(m.home, m.away, {});
    
    const isHit = probs.predictedWinner === actualWinner;
    if (isHit) correct++;

    if (actualWinner === 'HOME') { totalHome++; if (isHit) homeHits++; }
    else if (actualWinner === 'DRAW') { totalDraw++; if (isHit) drawHits++; }
    else if (actualWinner === 'AWAY') { totalAway++; if (isHit) awayHits++; }

    const yH = actualWinner === 'HOME' ? 1 : 0;
    const yD = actualWinner === 'DRAW' ? 1 : 0;
    const yA = actualWinner === 'AWAY' ? 1 : 0;
    const pH = Math.max(0.001, Math.min(0.999, probs.home / 100));
    const pD = Math.max(0.001, Math.min(0.999, probs.draw / 100));
    const pA = Math.max(0.001, Math.min(0.999, probs.away / 100));

    // Multi-class Brier score: (p - y)^2 sum
    const brier = Math.pow(pH - yH, 2) + Math.pow(pD - yD, 2) + Math.pow(pA - yA, 2);
    totalBrier += brier;

    // Multi-class Log-Loss: - (y * log(p))
    const logLoss = -(yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA));
    totalLogLoss += logLoss;

    // Slices (League vs Cup)
    if (m.isCup) {
      cupTotal++;
      if (isHit) cupCorrect++;
      cupBrier += brier;
    } else {
      leagueTotal++;
      if (isHit) leagueCorrect++;
      leagueBrier += brier;
    }
  }

  const n = matchSubset.length;
  return {
    accuracy: (correct / n) * 100,
    brierScore: totalBrier / n,
    logLoss: totalLogLoss / n,
    homeHitRate: totalHome > 0 ? (homeHits / totalHome) * 100 : 0,
    drawHitRate: totalDraw > 0 ? (drawHits / totalDraw) * 100 : 0,
    awayHitRate: totalAway > 0 ? (awayHits / totalAway) * 100 : 0,
    sliceLeague: {
      total: leagueTotal,
      accuracy: leagueTotal > 0 ? (leagueCorrect / leagueTotal) * 100 : 0,
      brier: leagueTotal > 0 ? leagueBrier / leagueTotal : 0
    },
    sliceCup: {
      total: cupTotal,
      accuracy: cupTotal > 0 ? (cupCorrect / cupTotal) * 100 : 0,
      brier: cupTotal > 0 ? cupBrier / cupTotal : 0
    }
  };
}

console.log('Running Grid Search optimization on Training Set...');

let bestBrier = Infinity;
let bestParams = null;
let bestTrainResult = null;

for (const ha of homeAdvantageRange) {
  for (const elo of homeEloBoostRange) {
    for (const drawDelta of drawEquilibriumDeltaRange) {
      engine.hyperparameters.homeAdvantage = ha;
      engine.hyperparameters.homeEloBoost = elo;
      engine.hyperparameters.drawEquilibriumDelta = drawDelta;

      const result = evaluateSet(trainMatches);

      if (result.brierScore < bestBrier) {
        bestBrier = result.brierScore;
        bestParams = { homeAdvantage: ha, homeEloBoost: elo, drawEquilibriumDelta: drawDelta };
        bestTrainResult = result;
      }
    }
  }
}

// Evaluate on Holdout Test Set using best parameters
engine.hyperparameters.homeAdvantage = bestParams.homeAdvantage;
engine.hyperparameters.homeEloBoost = bestParams.homeEloBoost;
engine.hyperparameters.drawEquilibriumDelta = bestParams.drawEquilibriumDelta;
const testResult = evaluateSet(testMatches);
const fullResult = evaluateSet(matches);

console.log('\n======================================================');
console.log('HYPERPARAMETER OPTIMIZATION RESULTS');
console.log('======================================================');
console.log(`Optimal Parameters Discovered:`, bestParams);
console.log(`Train Accuracy:   ${bestTrainResult.accuracy.toFixed(2)}% | Brier Score: ${bestTrainResult.brierScore.toFixed(4)} | Log-Loss: ${bestTrainResult.logLoss.toFixed(4)}`);
console.log(`Test Accuracy:    ${testResult.accuracy.toFixed(2)}% | Brier Score: ${testResult.brierScore.toFixed(4)} | Log-Loss: ${testResult.logLoss.toFixed(4)}`);
console.log(`Full Set Accuracy: ${fullResult.accuracy.toFixed(2)}% | Brier Score: ${fullResult.brierScore.toFixed(4)}`);

console.log('\n------------------------------------------------------');
console.log('SLICE-BASED ANALYSIS: LEAGUES VS. CUPS (FA CUP, ETC.)');
console.log('------------------------------------------------------');
console.log(`Regular League Matches:`);
console.log(`  Count:    ${fullResult.sliceLeague.total}`);
console.log(`  Accuracy: ${fullResult.sliceLeague.accuracy.toFixed(2)}%`);
console.log(`  Brier:    ${fullResult.sliceLeague.brier.toFixed(4)}`);

console.log(`Cup Competitions (FA Cup, Copa del Rey, etc.):`);
console.log(`  Count:    ${fullResult.sliceCup.total}`);
console.log(`  Accuracy: ${fullResult.sliceCup.accuracy.toFixed(2)}%`);
console.log(`  Brier:    ${fullResult.sliceCup.brier.toFixed(4)}`);

console.log('\n------------------------------------------------------');
console.log('OUTCOME CLASS BREAKDOWN (FULL DATASET)');
console.log('------------------------------------------------------');
console.log(`Home Win Hit Rate: ${fullResult.homeHitRate.toFixed(2)}%`);
console.log(`Draw Hit Rate:     ${fullResult.drawHitRate.toFixed(2)}%`);
console.log(`Away Win Hit Rate: ${fullResult.awayHitRate.toFixed(2)}%`);

// Benchmark comparison against old baseline
const oldBaselineAccuracy = 45.48;
const oldBaselineBrier = 0.6230;
const accDelta = testResult.accuracy - oldBaselineAccuracy;
const brierDelta = testResult.brierScore - oldBaselineBrier;

console.log('\n------------------------------------------------------');
console.log('BENCHMARK COMPARISON AGAINST PREVIOUS BASELINE');
console.log('------------------------------------------------------');
console.log(`Previous Baseline (1,724 Top-5 League Matches): 45.48% Accuracy | 0.6230 Brier Score`);
console.log(`New Expanded Model (Holdout Test Set):         ${testResult.accuracy.toFixed(2)}% Accuracy | ${testResult.brierScore.toFixed(4)} Brier Score`);
console.log(`Accuracy Delta:  ${accDelta >= 0 ? '+' : ''}${accDelta.toFixed(2)}%`);
console.log(`Brier Delta:     ${brierDelta <= 0 ? '' : '+'}${brierDelta.toFixed(4)} (${brierDelta <= 0 ? 'IMPROVEMENT' : 'SLIGHT DEGRADATION'})`);

// Patch engine.js directly with the optimal weights
let engineFile = fs.readFileSync('engine.js', 'utf8');
engineFile = engineFile.replace(/homeAdvantage: [\d\.]+/, `homeAdvantage: ${bestParams.homeAdvantage}`);
engineFile = engineFile.replace(/homeEloBoost: [\d\.]+/, `homeEloBoost: ${bestParams.homeEloBoost}`);
engineFile = engineFile.replace(/drawEquilibriumDelta: [\d\.]+/, `drawEquilibriumDelta: ${bestParams.drawEquilibriumDelta}`);
fs.writeFileSync('engine.js', engineFile, 'utf8');

console.log('\nengine.js patched with discovered optimal weights!');
console.log('======================================================\n');
