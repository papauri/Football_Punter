const fs = require('fs');

let content = fs.readFileSync('engine.js', 'utf8');

content = content.replace(
  'const finalConfidence = Math.min(99.9, Math.max(finalHomeP, finalDrawP, finalAwayP) + dynamicBoost);',
  `const maxProb = Math.max(finalHomeP, finalDrawP, finalAwayP);
    const finalConfidence = Math.min(99.9, maxProb + ((100 - maxProb) * (dynamicBoost / 100)));`
);

content = content.replace(
  'binaryConfidence = Math.min(99.9, binaryConfidence + dynamicBoost);',
  'binaryConfidence = Math.min(99.9, binaryConfidence + ((100 - binaryConfidence) * (dynamicBoost / 100)));'
);

fs.writeFileSync('engine.js', content);
console.log("Patched dynamic boost");
