const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

// Fix 1: Live logic
content = content.replace(
    /\} else if \(is100Unanimous && \(consensusWinner === 'HOME' \|\| consensusWinner === 'AWAY'\) && \(match\.prob\?\.confidence >= 48 \|\| swarmScore >= 76\)\) \{/g,
    "} else if (is100Unanimous && (consensusWinner === 'HOME' || consensusWinner === 'AWAY') && match.prob?.confidence >= 52 && swarmScore >= 78) {"
);

// Fix 2: Historical Proof logic
content = content.replace(
    /\(probs\.confidence >= 48\);/g,
    "(probs.confidence >= 52 && syn.swarmScore >= 78);"
);

fs.writeFileSync('multiAgentSwarm.js', content);
console.log("Patched Unanimous Logic");
