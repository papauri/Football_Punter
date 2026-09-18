const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');
let depth = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
        if (lines[i][j] === '(') depth++;
        if (lines[i][j] === ')') depth--;
    }
}
console.log("Parenthesis depth:", depth);
