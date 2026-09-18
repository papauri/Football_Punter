const fs = require('fs');
let content = fs.readFileSync('engine.js', 'utf8');

// 1. Patch the constructor to load from hyperparameters.json safely
content = content.replace(
    /this\.hyperparameters = \{\s*homeAdvantage[\s\S]*?timeDecayXi: 0\.008\s*\/\/ Dixon-Coles exponential time decay parameter \(days\^-1\)\s*\};/,
    `const defaultHyperparameters = {
      homeAdvantage: 1.073,
      homeEloBoost: 55,
      leagueAvgGoalsHome: 1.50,
      leagueAvgGoalsAway: 1.20,
      homeGoalIntensity: 1.30,
      awayGoalIntensity: 1.10,
      goalOverdispersionR: 4.5,
      dixonColesRho: -0.18,
      temperature: 0.80,
      maxScorelineSim: 6,
      drawEquilibriumDelta: 13,
      h2hWeight: 0.12,
      timeDecayXi: 0.008
    };

    if (fs.existsSync('hyperparameters.json')) {
      try {
        const loadedParams = JSON.parse(fs.readFileSync('hyperparameters.json', 'utf8'));
        this.hyperparameters = { ...defaultHyperparameters, ...loadedParams };
      } catch (e) {
        this.hyperparameters = defaultHyperparameters;
      }
    } else {
      this.hyperparameters = defaultHyperparameters;
    }`
);

// 2. Rewrite the Deep Optimization method
const replacement = `  // DEEP MULTI-DIMENSIONAL RETRAINING & SOURCE CODE SELF-PATCH ENGINE
  // -------------------------------------------------------------
  async runDeepOptimizationAndSelfPatch() {
    this.log('SelfPatchEngine', 'Initiating Sequential Deep Retraining & Self-Patching Sequence...');

    // 1. Ingest full multi-month ESPN historical fixture corpus
    await this.scrapeESPNData();
    const matches = this.trainingSet;
    if (!matches || matches.length < 30) {
      this.log('SelfPatchEngine_Warning', 'Insufficient training samples available for deep optimization.');
      return { success: false, reason: 'Insufficient training data in active corpus' };
    }

    const previousStats = { ...this.trainingStats };
    const previousHyperparameters = { ...this.hyperparameters };
    this.log('SelfPatchEngine', \`Executing Sequence-Weighted minimization across \${matches.length} ground-truth matches...\`);

    // 2. Focused Sequential Hyperparameter Optimization Grid
    const homeAdvantageGrid = [1.06, 1.073, 1.10, 1.14];
    const rhoGrid = [-0.18, -0.12, -0.09];
    const drawEquilibriumGrid = [8.0, 10.0, 13.0];
    const h2hWeightGrid = [0.08, 0.12, 0.16];

    let bestWeightedBrier = Infinity;
    let bestAccuracy = 0;
    let bestParams = { ...this.hyperparameters };
    const totalCombinations = homeAdvantageGrid.length * rhoGrid.length * drawEquilibriumGrid.length * h2hWeightGrid.length;

    const timeDecayXi = this.hyperparameters.timeDecayXi || 0.008;

    for (const ha of homeAdvantageGrid) {
      for (const rho of rhoGrid) {
        for (const de of drawEquilibriumGrid) {
          for (const hw of h2hWeightGrid) {
            this.hyperparameters.homeAdvantage = ha;
            this.hyperparameters.dixonColesRho = rho;
            this.hyperparameters.drawEquilibriumDelta = de;
            this.hyperparameters.h2hWeight = hw;

            let totalWeightedBrier = 0;
            let totalWeight = 0;
            let correct = 0;

            for (const m of matches) {
              const hScore = m.homeScore ?? m.goals?.home;
              const aScore = m.awayScore ?? m.goals?.away;
              const actualWinner = m.actualWinner || (hScore > aScore ? 'HOME' : aScore > hScore ? 'AWAY' : 'DRAW');

              // Sequence Modeling: Exponential Time Decay Weighting
              let sequenceWeight = 1.0;
              if (m.timestamp) {
                const daysSince = Math.max(0, (Date.now() - m.timestamp) / (1000 * 60 * 60 * 24));
                sequenceWeight = Math.exp(-timeDecayXi * daysSince);
              } else if (m.dateIso) {
                const daysSince = Math.max(0, (Date.now() - new Date(m.dateIso).getTime()) / (1000 * 60 * 60 * 24));
                sequenceWeight = Math.exp(-timeDecayXi * daysSince);
              }

              const probs = this.computeDixonColesProbabilities(m.home, m.away);
              if (probs.predictedWinner === actualWinner) {
                correct++;
              }

              const yH = actualWinner === 'HOME' ? 1 : 0;
              const yD = actualWinner === 'DRAW' ? 1 : 0;
              const yA = actualWinner === 'AWAY' ? 1 : 0;
              const brier = Math.pow((probs.home / 100) - yH, 2) + Math.pow((probs.draw / 100) - yD, 2) + Math.pow((probs.away / 100) - yA, 2);
              
              totalWeightedBrier += (brier * sequenceWeight);
              totalWeight += sequenceWeight;
            }

            const avgWeightedBrier = totalWeight > 0 ? totalWeightedBrier / totalWeight : 1.0;
            const accuracy = (correct / matches.length) * 100;

            if (avgWeightedBrier < bestWeightedBrier) {
              bestWeightedBrier = avgWeightedBrier;
              bestAccuracy = accuracy;
              bestParams = {
                homeAdvantage: ha,
                dixonColesRho: rho,
                drawEquilibriumDelta: de,
                h2hWeight: hw
              };
            }
          }
        }
      }
    }

    // 3. Apply optimal weights to in-memory engine
    this.hyperparameters.homeAdvantage = bestParams.homeAdvantage;
    this.hyperparameters.dixonColesRho = bestParams.dixonColesRho;
    this.hyperparameters.drawEquilibriumDelta = bestParams.drawEquilibriumDelta;
    this.hyperparameters.h2hWeight = bestParams.h2hWeight;

    // 4. Safe Configuration Persistence via hyperparameters.json (replaces volatile regex patching)
    let isPatchedOnDisk = false;
    try {
      const mergedParams = { ...this.hyperparameters, ...bestParams };
      fs.writeFileSync('hyperparameters.json', JSON.stringify(mergedParams, null, 2), 'utf8');
      isPatchedOnDisk = true;
      this.log('SelfPatchEngine', \`hyperparameters.json permanently self-patched on disk with optimal sequence weights.\`);
    } catch (patchErr) {
      this.log('SelfPatchEngine_Warning', \`Self-patch disk write notice: \${patchErr.message}\`);
    }

    // 5. Retrain model and synchronize all active match predictions
    await this.runTrainingCycle();

    // 6. Record Self-Patch Audit Report
    const patchReport = {
      id: \`SEQ_PATCH_\${Date.now()}\`,
      timestamp: new Date().toLocaleTimeString(),
      sampleCount: matches.length,
      previousAccuracy: previousStats.accuracy,
      newAccuracy: parseFloat(bestAccuracy.toFixed(1)),
      accuracyDelta: parseFloat((bestAccuracy - previousStats.accuracy).toFixed(1)),
      previousBrier: previousStats.brierScore,
      newBrier: parseFloat(bestWeightedBrier.toFixed(3)),
      brierDelta: parseFloat((bestWeightedBrier - previousStats.brierScore).toFixed(3)),
      appliedHyperparameters: bestParams,
      previousHyperparameters,
      evaluatedCombinations: totalCombinations,
      isPatchedOnDisk
    };

    if (!this.selfPatchHistory) {
      this.selfPatchHistory = [];
    }
    this.selfPatchHistory.unshift(patchReport);
    if (this.selfPatchHistory.length > 10) this.selfPatchHistory.pop();

    this.log('SelfPatchEngine', \`Sequence Retrain & Self-Patch Complete! Tested \${totalCombinations} permutations over \${matches.length} matches. Optimal Weighted Brier: \${patchReport.newBrier.toFixed(3)} | Calibrated Hit Rate: \${patchReport.newAccuracy}% | Disk Patched: \${isPatchedOnDisk ? 'YES' : 'NO'}\`);

    return {
      success: true,
      report: patchReport,
      trainingStats: this.trainingStats,
      hyperparameters: this.hyperparameters
    };
  }`;

content = content.replace(/  \/\/ DEEP MULTI-DIMENSIONAL RETRAINING & SOURCE CODE SELF-PATCH ENGINE[\s\S]*?    \};\n  \}/, replacement);

fs.writeFileSync('engine.js', content);
console.log("Fully Patched Deep Optimization to Sequence Model");
