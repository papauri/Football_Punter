import fs from 'fs';
import { engine } from './engine.js';

const rawData = fs.readFileSync('training_data.json', 'utf8');
const matches = JSON.parse(rawData);

// The user mentioned the current time is around 2026-09-04. Let's find matches from Aug 2026 to Sep 2026.
// Also, filter out PSG and Real Madrid.
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

const missedMatches = [];

for (const m of targetMatches) {
  const actualWinner = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
  const probs = engine.computeDixonColesProbabilities(m.home, m.away, {});
  
  if (probs.predictedWinner !== actualWinner) {
    missedMatches.push({
      date: m.date,
      match: `${m.home} vs ${m.away}`,
      score: `${m.homeScore}-${m.awayScore}`,
      actual: actualWinner,
      predicted: probs.predictedWinner,
      probs: `H: ${probs.home.toFixed(1)}% | D: ${probs.draw.toFixed(1)}% | A: ${probs.away.toFixed(1)}%`
    });
  }
}

console.log(`Found ${missedMatches.length} missed matches recently (excluding PSG & RM).`);
for (const m of missedMatches) {
  console.log(`${m.date} | ${m.match} | Score: ${m.score} | Actual: ${m.actual} | Predicted: ${m.predicted} | Probs: ${m.probs}`);
}
