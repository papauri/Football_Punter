import { engine } from './engine.js';

const home = "Arsenal";
const away = "Everton";

console.log('--- BASELINE MATCH ---');
console.log(`${home} vs ${away} (Standard Conditions)`);
const baseline = engine.computeDixonColesProbabilities(home, away);
console.log(JSON.stringify({
    predictedWinner: baseline.predictedWinner,
    homeProb: baseline.home.toFixed(1) + '%',
    drawProb: baseline.draw.toFixed(1) + '%',
    awayProb: baseline.away.toFixed(1) + '%',
    lambda: baseline.lambda.toFixed(2),
    mu: baseline.mu.toFixed(2)
}, null, 2));

console.log('\n--- SUPER AGENT CONTEXT MATCH ---');
console.log('Condition 1: Arsenal is missing their key star (high gravity)');
console.log('Condition 2: Referee is Mateu Lahoz (Extremely strict: 10/10)');

const context = engine.computeDixonColesProbabilities(home, away, {
    homeMissingStar: true,
    awayMissingStar: false,
    referee: 'Mateu Lahoz'
});

console.log(JSON.stringify({
    predictedWinner: context.predictedWinner,
    homeProb: context.home.toFixed(1) + '%',
    drawProb: context.draw.toFixed(1) + '%',
    awayProb: context.away.toFixed(1) + '%',
    lambda: context.lambda.toFixed(2),
    mu: context.mu.toFixed(2)
}, null, 2));
