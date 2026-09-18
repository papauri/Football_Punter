const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

// Fix 1: Make average confidence display correctly on the dashboard instead of being hardcoded to 65 or 75
content = content.replace(
  `averageSwarmConfidence: 75,`,
  `averageSwarmConfidence: totalConfidence > 0 && allScored.length > 0 ? Math.round(totalConfidence / allScored.length) : 65,`
);

content = content.replace(
  `averageSwarmConfidence: 65,`,
  `averageSwarmConfidence: totalConfidence > 0 && allScored.length > 0 ? Math.round(totalConfidence / allScored.length) : 65,`
);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched confidence average logic");
