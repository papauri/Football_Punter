const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

const regex = /\} else if \(isSupermajority && swarmScore >= 72\) \{[\s\S]*?isUnanimousDirective = false;\n    \}/;

const replacement = `} else if (isSupermajority && swarmScore >= 72) {
      consensusTier = 'STRONG_SWARM_ALIGNMENT';
      tierBadge = '⚡ 6-Council Strong Alignment (5/6)';
      isTopValueLeg = false;
      isUnanimousDirective = false;
    } else if (agreeingAgents.length >= 4 && swarmScore >= 62) {
      consensusTier = 'LEANING_CONSENSUS';
      tierBadge = '🔍 Council Lean (4/6)';
      isTopValueLeg = false;
      isUnanimousDirective = false;
    }`;

content = content.replace(regex, replacement);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched Tiers");
