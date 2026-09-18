import fs from 'fs';
import { engine } from './engine.js';

const rawData = fs.readFileSync('training_data.json', 'utf8');
const matches = JSON.parse(rawData);

const recentMatches = matches.filter(m => {
  const matchDate = new Date(m.date);
  return matchDate >= new Date('2026-08-01') && matchDate <= new Date('2026-09-04');
});

const targetMatches = recentMatches.filter(m => {
  const home = m.home.toLowerCase();
  const away = m.away.toLowerCase();
  const involvesPSG = home.includes('paris') || away.includes('paris') || home.includes('psg') || away.includes('psg');
  const involvesRM = home.includes('real madrid') || away.includes('real madrid');
  return !involvesPSG && !involvesRM;
});

let totalTarget = targetMatches.length;
let missed = 0;
let predictedDrawWrong = 0;
let predictedHomeWrong = 0;
let predictedAwayWrong = 0;
let actualDrawWronglyPredicted = 0;

for (const m of targetMatches) {
  const actualWinner = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
  const probs = engine.computeDixonColesProbabilities(m.home, m.away, {});
  
  if (probs.predictedWinner !== actualWinner) {
    missed++;
    if (probs.predictedWinner === 'DRAW') predictedDrawWrong++;
    if (probs.predictedWinner === 'HOME') predictedHomeWrong++;
    if (probs.predictedWinner === 'AWAY') predictedAwayWrong++;
    if (actualWinner === 'DRAW') actualDrawWronglyPredicted++;
  }
}

console.log(`Total Target Matches: ${totalTarget}`);
console.log(`Total Misses: ${missed} (${(missed/totalTarget*100).toFixed(2)}%)`);
console.log(`Misses where we predicted DRAW: ${predictedDrawWrong} (${(predictedDrawWrong/missed*100).toFixed(2)}% of misses)`);
console.log(`Misses where we predicted HOME: ${predictedHomeWrong} (${(predictedHomeWrong/missed*100).toFixed(2)}% of misses)`);
console.log(`Misses where we predicted AWAY: ${predictedAwayWrong} (${(predictedAwayWrong/missed*100).toFixed(2)}% of misses)`);
console.log(`Misses where actual was DRAW: ${actualDrawWronglyPredicted} (${(actualDrawWronglyPredicted/missed*100).toFixed(2)}% of misses)`);
