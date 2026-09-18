const fs = require('fs');
let data = JSON.parse(fs.readFileSync('training_data.json', 'utf8'));
let pw = data.slice(-100).filter(m => m.predictedWinner !== undefined);
console.log(pw.slice(0, 2));
