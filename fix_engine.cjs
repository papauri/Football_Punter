const fs = require('fs');
let content = fs.readFileSync('engine.js', 'utf8');

// Find the section that was messed up:
const badSection = `    const finalConfidence = Math.min(99.9, Math.max(finalHomeP, finalDrawP, finalAwayP) + dynamicBoost);

    return {
      home: finalHomeP,
      draw: finalDrawP,
      away: finalAwayP,
      confidence: finalConfidence,
      predictedWinner: pick,
      
      // Inject dynamic boost into binary model as well
      if (typeof dynamicBoost !== 'undefined' && dynamicBoost > 0) {
          binaryConfidence = Math.min(99.9, binaryConfidence + dynamicBoost);
      }
      
      binaryModel: {
        pick: binaryPick,
        confidence: parseFloat(binaryConfidence.toFixed(1)),`;

const goodSection = `    const finalConfidence = Math.min(99.9, Math.max(finalHomeP, finalDrawP, finalAwayP) + dynamicBoost);

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
      binaryModel: {
        pick: binaryPick,
        confidence: parseFloat(binaryConfidence.toFixed(1)),`;

content = content.replace(badSection, goodSection);
fs.writeFileSync('engine.js', content, 'utf8');
console.log('Fixed syntax error in engine.js');
