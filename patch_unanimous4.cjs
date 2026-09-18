const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

content = content.replace(
    /} else if \(is100Unanimous && \(consensusWinner === 'HOME' \|\| consensusWinner === 'AWAY'\) && match\.prob\?\.confidence >= 55 && swarmScore >= 81\) \{/g,
    "} else if (is100Unanimous && (consensusWinner === 'HOME' || consensusWinner === 'AWAY') && match.prob?.confidence >= 56 && swarmScore >= 79) {"
);

content = content.replace(
    /\(probs\.confidence >= 55 && syn\.swarmScore >= 81\)/g,
    "(probs.confidence >= 56 && syn.swarmScore >= 79)"
);

fs.writeFileSync('multiAgentSwarm.js', content);
