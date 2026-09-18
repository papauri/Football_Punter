const fs = require('fs');
let data = JSON.parse(fs.readFileSync('training_data.json', 'utf8'));
let m = data[data.length - 1];
console.log(m);
