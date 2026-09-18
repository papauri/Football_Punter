import { engine } from './engine.js';

// Wait a bit to ensure it has initialized, though it should be synchronous for the database
const home = "Tottenham Hotspur"; // LineHeight 10, CounterVelocity 7
const away = "Nottingham Forest"; // LineHeight 3, CounterVelocity 9

console.log('Testing Tactical Multipliers between:');
console.log(`${home} (Line Height: 10) vs ${away} (Counter Velocity: 9)`);

const homeRating = engine.getTeamRating(home);
const awayRating = engine.getTeamRating(away);

console.log('\n--- TACTICAL MULTIPLIERS ---');
const homeBoost = engine.computeTacticalMultiplier(homeRating, awayRating);
const awayBoost = engine.computeTacticalMultiplier(awayRating, homeRating);

console.log(`${home} Tactical Multiplier (their counter vs away line): ${homeBoost.toFixed(3)}`);
console.log(`${away} Tactical Multiplier (their counter vs home line): ${awayBoost.toFixed(3)}`);

console.log('\n--- MATCH PREDICTION ---');
const prediction = engine.computeDixonColesProbabilities(home, away);
console.log(JSON.stringify({
    predictedWinner: prediction.predictedWinner,
    homeProb: prediction.home.toFixed(1) + '%',
    drawProb: prediction.draw.toFixed(1) + '%',
    awayProb: prediction.away.toFixed(1) + '%',
    mostLikelyScore: prediction.mostLikelyScore,
    lambda: prediction.lambda,
    mu: prediction.mu
}, null, 2));
