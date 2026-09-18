const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

// Fix 1: Add dynamic logic to conviction calculations rather than defaulting to hardcoded limits or low bounds.
// Replace the hardcoded 50s and low ceilings with more dynamic calculations based on the underlying win probabilities.
// We'll replace the static formula `Math.min(99, Math.round(avgConviction * 0.6 + agreementPercentage * 0.4))` with a more dynamic version that factors in the base confidence.

content = content.replace(
  `const swarmScore = Math.min(99, Math.round(avgConviction * 0.6 + agreementPercentage * 0.4));`,
  `const baseConfidence = match?.prob?.confidence || 50;
    const swarmScore = Math.min(99, Math.round(avgConviction * 0.5 + agreementPercentage * 0.3 + baseConfidence * 0.2));`
);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched conviction logic");
