const fs = require('fs');
let data = JSON.parse(fs.readFileSync('training_data.json', 'utf8'));
let hits = data.slice(-100).filter(m => m.isHit !== undefined);
console.log(hits.slice(0, 2));
