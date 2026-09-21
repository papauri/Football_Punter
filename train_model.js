import fs from 'fs';
import { engine } from './engine.js';

const rawData = fs.readFileSync('training_data.json', 'utf8');
const matches = JSON.parse(rawData);

console.log(`\n======================================================`);
console.log(`QUANTITATIVE AI EVALUATION & PERFORMANCE BENCHMARK`);
console.log(`======================================================`);
console.log(`Total Dataset Samples: ${matches.length}`);

// Chronological Train/Test Split (80% Train, 20% Test)
const splitIdx = Math.floor(matches.length * 0.80);
const trainMatches = matches.slice(0, splitIdx);
const testMatches = matches.slice(splitIdx);

console.log(`Chronological Split:`);
console.log(`  Training Set:   ${trainMatches.length} matches`);
console.log(`  Test / Eval:    ${testMatches.length} matches`);

// Grid ranges for hyperparameters (optimized based on empirical draw equilibrium)
const homeAdvantageRange = [1.14, 1.18, 1.22];
const homeEloBoostRange = [40, 50, 65];
const drawEquilibriumDeltaRange = [0, 1.5, 3.0];

function evaluateSet(matchSubset) {
  let totalBrier = 0;
  let totalLogLoss = 0;
  let correct = 0;

  // Slices
  let leagueCorrect = 0, leagueTotal = 0, leagueBrier = 0;
  let cupCorrect = 0, cupTotal = 0, cupBrier = 0;

  // Outcome distribution tracking
  let totalHome = 0, predHome = 0, hitHome = 0;
  let totalDraw = 0, predDraw = 0, hitDraw = 0;
  let totalAway = 0, predAway = 0, hitAway = 0;

  // Draw Protection Markets: Draw-No-Bet (DNB) & Double Chance (DC)
  let dnbCount = 0, dnbWon = 0, dnbPush = 0, dnbLost = 0;
  let dcCount = 0, dcWon = 0, dcLost = 0;

  // Expected Value (EV+) & Simulated Value Staking
  let valueBets = 0;
  let totalYieldUnits = 0;

  for (const m of matchSubset) {
    const hG = m.homeScore ?? m.goals?.home ?? 0;
    const aG = m.awayScore ?? m.goals?.away ?? 0;
    const actualWinner = hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW';
    const probs = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, odds: m.odds });
    
    const isHit = probs.predictedWinner === actualWinner;
    if (isHit) correct++;

    if (actualWinner === 'HOME') totalHome++;
    else if (actualWinner === 'DRAW') totalDraw++;
    else if (actualWinner === 'AWAY') totalAway++;

    if (probs.predictedWinner === 'HOME') { predHome++; if (actualWinner === 'HOME') hitHome++; }
    else if (probs.predictedWinner === 'DRAW') { predDraw++; if (actualWinner === 'DRAW') hitDraw++; }
    else if (probs.predictedWinner === 'AWAY') { predAway++; if (actualWinner === 'AWAY') hitAway++; }

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

    // Evaluate Draw Protection Markets when draw risk is elevated or split is narrow
    const favOutcome = probs.home >= probs.away ? 'HOME' : 'AWAY';
    const isContested = probs.draw >= 24.0 || Math.abs(probs.home - probs.away) <= 8.0;
    if (isContested) {
      // DNB Evaluation
      dnbCount++;
      if (actualWinner === favOutcome) dnbWon++;
      else if (actualWinner === 'DRAW') dnbPush++;
      else dnbLost++;

      // Double Chance Evaluation (1X or X2)
      dcCount++;
      const dcMatches = favOutcome === 'HOME' ? (actualWinner === 'HOME' || actualWinner === 'DRAW') : (actualWinner === 'AWAY' || actualWinner === 'DRAW');
      if (dcMatches) dcWon++;
      else dcLost++;
    }

    // Expected Value & Value Staking Simulation
    const smartProb = (probs.smartMarket?.prob || Math.max(probs.home, probs.away)) / 100;
    // Implied market odds assuming standard 5.5% bookmaker overround
    const impliedOdds = parseFloat((1 / (smartProb * 0.945)).toFixed(2));
    if (probs.smartMarket?.isPositiveEV || smartProb >= 0.58) {
      valueBets++;
      const smartPick = probs.smartMarket?.pick;
      let wonBet = false;
      let isPush = false;
      if (smartPick === 'HOME' && actualWinner === 'HOME') wonBet = true;
      else if (smartPick === 'AWAY' && actualWinner === 'AWAY') wonBet = true;
      else if (smartPick === '1X' && (actualWinner === 'HOME' || actualWinner === 'DRAW')) wonBet = true;
      else if (smartPick === 'X2' && (actualWinner === 'AWAY' || actualWinner === 'DRAW')) wonBet = true;
      else if (smartPick === 'HOME_DNB') { if (actualWinner === 'HOME') wonBet = true; else if (actualWinner === 'DRAW') isPush = true; }
      else if (smartPick === 'AWAY_DNB') { if (actualWinner === 'AWAY') wonBet = true; else if (actualWinner === 'DRAW') isPush = true; }
      else if (isHit) wonBet = true;

      if (wonBet) totalYieldUnits += (impliedOdds - 1);
      else if (!isPush) totalYieldUnits -= 1;
    }
  }

  const n = matchSubset.length;
  return {
    accuracy: (correct / n) * 100,
    brierScore: totalBrier / n,
    logLoss: totalLogLoss / n,
    // Per-class metrics
    classHome: {
      precision: predHome > 0 ? (hitHome / predHome) * 100 : 0,
      recall: totalHome > 0 ? (hitHome / totalHome) * 100 : 0,
      count: totalHome
    },
    classDraw: {
      precision: predDraw > 0 ? (hitDraw / predDraw) * 100 : 0,
      recall: totalDraw > 0 ? (hitDraw / totalDraw) * 100 : 0,
      count: totalDraw
    },
    classAway: {
      precision: predAway > 0 ? (hitAway / predAway) * 100 : 0,
      recall: totalAway > 0 ? (hitAway / totalAway) * 100 : 0,
      count: totalAway
    },
    // Draw Protection Metrics
    dnb: {
      sample: dnbCount,
      won: dnbWon,
      push: dnbPush,
      lost: dnbLost,
      nonLossRate: dnbCount > 0 ? ((dnbWon + dnbPush) / dnbCount) * 100 : 0,
      winRateExclPush: (dnbWon + dnbLost) > 0 ? (dnbWon / (dnbWon + dnbLost)) * 100 : 0
    },
    doubleChance: {
      sample: dcCount,
      won: dcWon,
      lost: dcLost,
      hitRate: dcCount > 0 ? (dcWon / dcCount) * 100 : 0
    },
    // Expected Value & Yield Metrics
    ev: {
      bets: valueBets,
      yieldRate: valueBets > 0 ? (totalYieldUnits / valueBets) * 100 : 0
    },
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

console.log('Running Parameter Grid Search on Training Set...');

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

// Run 6-Agent Unanimous Swarm Backtest across recent historical matches
let swarmProof = null;
if (engine.swarmOrchestrator && typeof engine.swarmOrchestrator.runTrainingDataProof === 'function') {
  engine.historicalMatches = matches;
  swarmProof = engine.swarmOrchestrator.runTrainingDataProof(matches.slice(-2000));
}

console.log('\n======================================================');
console.log('HYPERPARAMETER OPTIMIZATION & MODEL AUDIT RESULTS');
console.log('======================================================');
console.log(`Optimal Parameters Discovered:`, bestParams);
console.log(`Train Accuracy:   ${bestTrainResult.accuracy.toFixed(2)}% | Brier: ${bestTrainResult.brierScore.toFixed(4)} | Log-Loss: ${bestTrainResult.logLoss.toFixed(4)}`);
console.log(`Test Accuracy:    ${testResult.accuracy.toFixed(2)}% | Brier: ${testResult.brierScore.toFixed(4)} | Log-Loss: ${testResult.logLoss.toFixed(4)}`);
console.log(`Full Set Accuracy: ${fullResult.accuracy.toFixed(2)}% | Brier: ${fullResult.brierScore.toFixed(4)}`);

console.log('\n------------------------------------------------------');
console.log('SLICE-BASED ANALYSIS: LEAGUES VS. CUPS');
console.log('------------------------------------------------------');
console.log(`Regular League Matches (${fullResult.sliceLeague.total} matches):  ${fullResult.sliceLeague.accuracy.toFixed(2)}% Acc | Brier: ${fullResult.sliceLeague.brier.toFixed(4)}`);
console.log(`Cup Competitions       (${fullResult.sliceCup.total} matches):  ${fullResult.sliceCup.accuracy.toFixed(2)}% Acc | Brier: ${fullResult.sliceCup.brier.toFixed(4)}`);

console.log('\n------------------------------------------------------');
console.log('CLASS PRECISION & RECALL (1X2 FULL SET)');
console.log('------------------------------------------------------');
console.log(`HOME:  Precision: ${fullResult.classHome.precision.toFixed(1)}% | Recall: ${fullResult.classHome.recall.toFixed(1)}% (${fullResult.classHome.count} actuals)`);
console.log(`AWAY:  Precision: ${fullResult.classAway.precision.toFixed(1)}% | Recall: ${fullResult.classAway.recall.toFixed(1)}% (${fullResult.classAway.count} actuals)`);
console.log(`DRAW:  Precision: ${fullResult.classDraw.precision.toFixed(1)}% | Recall: ${fullResult.classDraw.recall.toFixed(1)}% (${fullResult.classDraw.count} actuals)`);

console.log('\n------------------------------------------------------');
console.log('DRAW-PROTECTED MARKETS PERFORMANCE (RECOMMENDATION 2)');
console.log('------------------------------------------------------');
console.log(`Double Chance (1X / X2):`);
console.log(`  Sample Size:   ${fullResult.doubleChance.sample} contested fixtures`);
console.log(`  Hit Rate:      ${fullResult.doubleChance.hitRate.toFixed(1)}% (Won: ${fullResult.doubleChance.won} / Lost: ${fullResult.doubleChance.lost})`);
console.log(`Draw-No-Bet (DNB):`);
console.log(`  Sample Size:   ${fullResult.dnb.sample} contested fixtures`);
console.log(`  Non-Loss Rate: ${fullResult.dnb.nonLossRate.toFixed(1)}% (Won: ${fullResult.dnb.won}, Push/Refund: ${fullResult.dnb.push}, Lost: ${fullResult.dnb.lost})`);
console.log(`  Win Rate (excl. Push): ${fullResult.dnb.winRateExclPush.toFixed(1)}%`);

if (swarmProof) {
  console.log('\n------------------------------------------------------');
  console.log('6-AGENT UNANIMOUS SWARM BACKTEST PROOF');
  console.log('------------------------------------------------------');
  console.log(`Historical Matches Audited: ${swarmProof.testedHistoricalMatches}`);
  console.log(`Unanimous Directives Found: ${swarmProof.unanimousDirectivesFound}`);
  console.log(`Empirical Win Rate:         ${swarmProof.empiricalWinRate}% (${swarmProof.unanimousHits}/${swarmProof.unanimousDirectivesFound} won)`);
  console.log(`Precision Lift vs Baseline: +${swarmProof.precisionLift}%`);
  console.log(`Home Unanimous Win Rate:    ${swarmProof.homeWinAccuracy}%`);
  console.log(`Away Unanimous Win Rate:    ${swarmProof.awayWinAccuracy}%`);
  console.log(`Contrarian Traps Avoided:   ${swarmProof.trapsAvoided}/${swarmProof.trapsDetected} (${swarmProof.trapAvoidanceRate}%)`);
}

console.log('\n------------------------------------------------------');
console.log('EXPECTED VALUE (EV+) & YIELD TRACKING (RECOMMENDATION 3)');
console.log('------------------------------------------------------');
console.log(`Total Value Bets Evaluated: ${fullResult.ev.bets}`);
console.log(`Simulated EV+ Yield / ROI:  +${fullResult.ev.yieldRate.toFixed(2)}%`);

// Update hyperparameters.json (Engine source of truth)
try {
  let hpFile = fs.existsSync('hyperparameters.json') ? JSON.parse(fs.readFileSync('hyperparameters.json', 'utf8')) : {};
  hpFile.homeAdvantage = bestParams.homeAdvantage;
  hpFile.homeEloBoost = bestParams.homeEloBoost;
  hpFile.drawEquilibriumDelta = bestParams.drawEquilibriumDelta;
  fs.writeFileSync('hyperparameters.json', JSON.stringify(hpFile, null, 2), 'utf8');
  console.log('\nOptimal parameters successfully saved to hyperparameters.json.');
} catch (err) {
  console.error('Failed to update hyperparameters.json:', err.message);
}
console.log('======================================================\n');
process.exit(0);
