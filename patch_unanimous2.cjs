const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

// Modify the logic to reach ~84% hit rate
content = content.replace(
    /} else if \(is100Unanimous && \(consensusWinner === 'HOME' \|\| consensusWinner === 'AWAY'\) && match\.prob\?\.confidence >= 52 && swarmScore >= 78\) \{/g,
    "} else if (is100Unanimous && (consensusWinner === 'HOME' || consensusWinner === 'AWAY') && match.prob?.confidence >= 55 && swarmScore >= 80) {"
);

content = content.replace(
    /\(probs\.confidence >= 52 && syn\.swarmScore >= 78\)/g,
    "(probs.confidence >= 55 && syn.swarmScore >= 80)"
);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched Unanimous Logic 2");
