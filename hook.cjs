const fs = require('fs');
let content = fs.readFileSync('engine.js', 'utf8');

content = content.replace(
    /this\.log\('TrainingEngine', `Loaded \$\{this\.historicalMatches\.length\} historical matches from training_data\.json\.`\);/g,
    `this.log('TrainingEngine', \`Loaded \$\{this.historicalMatches.length\} historical matches from training_data.json.\`);
      this.trainingSet = this.historicalMatches; // ensure trainingSet is alias
      this.calibratePredictabilityMetrics();`
);

fs.writeFileSync('engine.js', content, 'utf8');
console.log('Hooked calibratePredictabilityMetrics into loadTrainingDataFromDisk.');
