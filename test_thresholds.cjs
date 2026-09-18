const enginePath = './engine.js';
const swarmPath = './multiAgentSwarm.js';
// We can just load the engine and test it.
const { FootballPredictionEngine } = require('./engine.js');
async function run() {
  const engine = new FootballPredictionEngine();
  await engine.initialize();
  // It loads historical matches.
  // We can test different thresholds.
  const sampleSet = engine.historicalMatches || [];
  const matchesToTest = sampleSet.slice(-2000);
  console.log(`Loaded ${matchesToTest.length} historical matches`);
  
  for (let conf = 50; conf <= 60; conf += 2) {
    for (let score = 75; score <= 85; score += 2) {
      let unanCount = 0;
      let unanHits = 0;
      for (const m of matchesToTest) {
         // evaluate match using engine
         const dcProbs = engine.computeDixonColesProbabilities(m.home || m.homeTeam, m.away || m.awayTeam);
         // mock synthesis... actually too complex to mock.
      }
    }
  }
}
run();
