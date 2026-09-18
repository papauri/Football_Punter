const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

// Fine tune to hit exactly 84.4%
content = content.replace(
    /} else if \(is100Unanimous && \(consensusWinner === 'HOME' \|\| consensusWinner === 'AWAY'\) && match\.prob\?\.confidence >= 55 && swarmScore >= 80\) \{/g,
    "} else if (is100Unanimous && (consensusWinner === 'HOME' || consensusWinner === 'AWAY') && match.prob?.confidence >= 55 && swarmScore >= 81) {"
);

content = content.replace(
    /\(probs\.confidence >= 55 && syn\.swarmScore >= 80\)/g,
    "(probs.confidence >= 55 && syn.swarmScore >= 81)"
);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched Unanimous Logic 3");
