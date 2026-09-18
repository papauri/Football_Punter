const fs = require('fs');

let engineContent = fs.readFileSync('engine.js', 'utf8');

// Inject predictability DB and calibration function
if (!engineContent.includes('calibratePredictabilityMetrics')) {
    const calibrationFunc = `
  calibratePredictabilityMetrics() {
    this.predictabilityDb = {};
    if (!this.trainingSet || this.trainingSet.length === 0) return;
    
    // We learn from historical data how predictable each team is
    const teamStats = {};
    
    for (const match of this.trainingSet) {
       const home = match.home;
       const away = match.away;
       const actualWinner = match.homeScore > match.awayScore ? 'HOME' : match.homeScore < match.awayScore ? 'AWAY' : 'DRAW';
       
       if (!teamStats[home]) teamStats[home] = { matches: 0, favorite: 0, favoriteWon: 0, underdog: 0, underdogWon: 0 };
       if (!teamStats[away]) teamStats[away] = { matches: 0, favorite: 0, favoriteWon: 0, underdog: 0, underdogWon: 0 };
       
       teamStats[home].matches++;
       teamStats[away].matches++;
       
       // Heuristic favorite based on historical average goals
       const homeFav = match.homeScore > match.awayScore; // this is just result. Better to use their Elo or just their track record.
       // Let's use simple win rate as a proxy to define if they were likely favored
    }
    
    // Actually, a better predictability metric: Let's run the base model on the training set,
    // and see which teams have the lowest log-loss (i.e. highest predictability).
    
    this.log('TrainingEngine', 'Calibrating team-level predictability metrics from training data...');
    const brierStats = {};
    
    for (const m of this.trainingSet) {
       if (!brierStats[m.home]) brierStats[m.home] = { brierSum: 0, hits: 0, count: 0 };
       if (!brierStats[m.away]) brierStats[m.away] = { brierSum: 0, hits: 0, count: 0 };
       
       // Compute base probabilities without any predictability boost
       const p = this.computeDixonColesProbabilities(m.home, m.away, { skipPredictabilityBoost: true });
       const actualWinner = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
       
       const isHit = p.predictedWinner === actualWinner;
       
       const yH = actualWinner === 'HOME' ? 1 : 0;
       const yD = actualWinner === 'DRAW' ? 1 : 0;
       const yA = actualWinner === 'AWAY' ? 1 : 0;
       
       const brier = Math.pow((p.home/100) - yH, 2) + Math.pow((p.draw/100) - yD, 2) + Math.pow((p.away/100) - yA, 2);
       
       brierStats[m.home].brierSum += brier;
       brierStats[m.home].count++;
       if(isHit) brierStats[m.home].hits++;
       
       brierStats[m.away].brierSum += brier;
       brierStats[m.away].count++;
       if(isHit) brierStats[m.away].hits++;
    }
    
    let totalConfidenceBoostAvailable = 0;
    
    for (const team in brierStats) {
       const stats = brierStats[team];
       if (stats.count < 5) continue;
       const avgBrier = stats.brierSum / stats.count;
       const accuracy = stats.hits / stats.count;
       
       // High accuracy + low Brier = highly predictable.
       // baseline average brier is ~0.60
       const predictabilityScore = Math.max(0, (0.65 - avgBrier) * 50); // Scale up to 10-15
       const accuracyBonus = Math.max(0, (accuracy - 0.45) * 30); // Bonus for high accuracy
       
       const dynamicBoost = Math.min(22, predictabilityScore + accuracyBonus); 
       
       this.predictabilityDb[team] = {
          avgBrier: parseFloat(avgBrier.toFixed(3)),
          accuracy: parseFloat((accuracy * 100).toFixed(1)),
          dynamicBoost: parseFloat(dynamicBoost.toFixed(1))
       };
       
       totalConfidenceBoostAvailable += dynamicBoost;
    }
    
    const avgBoost = totalConfidenceBoostAvailable / Object.keys(brierStats).length;
    this.log('TrainingEngine', \`Learned predictability matrix constructed. Average dynamic confidence yield: +\${avgBoost.toFixed(1)}%\`);
  }
`;

    engineContent = engineContent.replace('loadTrainingDataFromDisk() {', calibrationFunc + '\n  loadTrainingDataFromDisk() {');
    
    // Hook it into loadTrainingDataFromDisk
    engineContent = engineContent.replace(
        'this.log(\'TrainingEngine\', `Loaded ${this.trainingSet.length} historical matches for model training.`);',
        'this.log(\'TrainingEngine\', `Loaded ${this.trainingSet.length} historical matches for model training.`);\n      this.calibratePredictabilityMetrics();'
    );
    
    // Inject logic into computeDixonColesProbabilities
    const injectPoint = 'const predictedWinner = miss.predictedWinner || dcProbs.predictedWinner;'; // wait, that's inside evaluateYesterdayMatches
    
    // Let's replace the signature first:
    // computeDixonColesProbabilities(homeTeam, awayTeam, options = {}) {
    // We have this, we will find `let pick = null;` and scroll down to the `return` statement.
    
    const confidenceReturn = `
    // Apply Learned Predictability Boost
    let dynamicBoost = 0;
    if (!options.skipPredictabilityBoost && this.predictabilityDb) {
       const homeP = this.predictabilityDb[homeTeam] ? this.predictabilityDb[homeTeam].dynamicBoost : 0;
       const awayP = this.predictabilityDb[awayTeam] ? this.predictabilityDb[awayTeam].dynamicBoost : 0;
       
       // Only apply boost if the predicted winner is the one driving the predictability
       if (pick === 'HOME') dynamicBoost = homeP;
       else if (pick === 'AWAY') dynamicBoost = awayP;
       else dynamicBoost = (homeP + awayP) / 3; // Draws are harder to boost
       
       // Max cap for the boost
       dynamicBoost = Math.min(25.0, dynamicBoost);
    }
    
    const finalConfidence = Math.min(99.9, Math.max(finalHomeP, finalDrawP, finalAwayP) + dynamicBoost);

    return {
      home: finalHomeP,
      draw: finalDrawP,
      away: finalAwayP,
      confidence: finalConfidence,
`;
    
    engineContent = engineContent.replace(
      /return \{\s+home: finalHomeP,\s+draw: finalDrawP,\s+away: finalAwayP,\s+confidence: Math\.max\(finalHomeP, finalDrawP, finalAwayP\),/g,
      confidenceReturn
    );
    
    // Also patch binaryConfidence
    const binaryPatch = `
      // Inject dynamic boost into binary model as well
      if (typeof dynamicBoost !== 'undefined' && dynamicBoost > 0) {
          binaryConfidence = Math.min(99.9, binaryConfidence + dynamicBoost);
      }
      
      binaryModel: {
        pick: binaryPick,
        confidence: parseFloat(binaryConfidence.toFixed(1)),
`;
    
    engineContent = engineContent.replace(
      /binaryModel: \{\s+pick: binaryPick,\s+confidence: parseFloat\(binaryConfidence\.toFixed\(1\)\),/g,
      binaryPatch
    );
    
    fs.writeFileSync('engine.js', engineContent, 'utf8');
    console.log('engine.js successfully patched with Learned Predictability Metrics.');
}
