const fs = require('fs');
let content = fs.readFileSync('engine.js', 'utf8');

content = content.replace(
    /return \{\s+home: finalHomeP,\s+draw: finalDrawP,\s+away: finalAwayP,\s+confidence: finalConfidence,\s+predictedWinner: pick,\s+\/\/ Inject dynamic boost into binary model as well\s+if \(typeof dynamicBoost !== 'undefined' && dynamicBoost > 0\) \{\s+binaryConfidence = Math\.min\(99\.9, binaryConfidence \+ dynamicBoost\);\s+\}\s+binaryModel: \{/g,
    `
    // Inject dynamic boost into binary model as well
    if (typeof dynamicBoost !== 'undefined' && dynamicBoost > 0) {
        binaryConfidence = Math.min(99.9, binaryConfidence + dynamicBoost);
    }
    return {
      home: finalHomeP,
      draw: finalDrawP,
      away: finalAwayP,
      confidence: finalConfidence,
      predictedWinner: pick,
      binaryModel: {`
);

fs.writeFileSync('engine.js', content, 'utf8');
console.log('Fixed syntax error via regex in engine.js');
