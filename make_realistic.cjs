const fs = require('fs');

let engineContent = fs.readFileSync('engine.js', 'utf8');

const regex = /calibratePredictabilityMetrics\(\) \{[\s\S]*?this\.log\('TrainingEngine', `Learned predictability matrix constructed. Average dynamic confidence yield: \+\$\{avgBoost\.toFixed\(1\)\}%`\);\n  \}/;

const realisticCalibration = `calibratePredictabilityMetrics() {
    this.predictabilityDb = {};
    if (!this.trainingSet || this.trainingSet.length === 0) return;

    this.log('TrainingEngine', 'Calibrating true empirical predictability metrics from historical data...');
    const calibrationStats = {};

    for (const m of this.trainingSet) {
       // Run base model probabilities
       const p = this.computeDixonColesProbabilities(m.home, m.away, { skipPredictabilityBoost: true });
       const actualWinner = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';

       // We only evaluate teams when the model picks them as the favorite
       const favoredTeam = p.predictedWinner === 'HOME' ? m.home : p.predictedWinner === 'AWAY' ? m.away : null;
       
       if (favoredTeam) {
           if (!calibrationStats[favoredTeam]) {
               calibrationStats[favoredTeam] = { predictedProbSum: 0, actualWins: 0, count: 0 };
           }

           const predictedProb = p.predictedWinner === 'HOME' ? p.home : p.away;
           calibrationStats[favoredTeam].predictedProbSum += predictedProb;
           calibrationStats[favoredTeam].count++;
           if (actualWinner === p.predictedWinner) {
               calibrationStats[favoredTeam].actualWins++;
           }
       }
    }

    let totalYield = 0;
    let validTeams = 0;

    for (const team in calibrationStats) {
       const stats = calibrationStats[team];
       if (stats.count < 10) continue; // Need a statistically significant sample size

       const avgPredictedProb = stats.predictedProbSum / stats.count;
       const actualWinRate = (stats.actualWins / stats.count) * 100;

       // Realistic dynamic boost: how much does this team historically beat the baseline model?
       // (e.g., if model predicts 60% win, but they actually win 68% of the time, the boost is +8.0%)
       let empiricalBoost = actualWinRate - avgPredictedProb;

       // Cap extreme outliers to maintain mathematical integrity
       empiricalBoost = Math.max(-15.0, Math.min(18.0, empiricalBoost));

       this.predictabilityDb[team] = {
          avgPredictedProb: parseFloat(avgPredictedProb.toFixed(2)),
          actualWinRate: parseFloat(actualWinRate.toFixed(2)),
          dynamicBoost: parseFloat(empiricalBoost.toFixed(2))
       };

       totalYield += empiricalBoost;
       validTeams++;
    }

    const avgBoost = validTeams > 0 ? (totalYield / validTeams) : 0;
    this.log('TrainingEngine', \`Realistic data-driven predictability matrix applied. Average empirical confidence offset: \${avgBoost > 0 ? '+' : ''}\${avgBoost.toFixed(2)}%\`);
  }`;

engineContent = engineContent.replace(regex, realisticCalibration);
fs.writeFileSync('engine.js', engineContent, 'utf8');
console.log('Successfully replaced artificial boost with realistic data-driven calibration.');
