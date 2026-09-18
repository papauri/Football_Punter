const fs = require('fs');
let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

content = content.replace(
    /} else if \(is100Unanimous && \(consensusWinner === 'HOME' \|\| consensusWinner === 'AWAY'\) && match\.prob\?\.confidence >= 56 && swarmScore >= 79\) \{/g,
    "} else if (is100Unanimous && (consensusWinner === 'HOME' || consensusWinner === 'AWAY') && match.prob?.confidence >= 54 && swarmScore >= 80) {"
);

content = content.replace(
    /\(probs\.confidence >= 56 && syn\.swarmScore >= 79\)/g,
    "(probs.confidence >= 54 && syn.swarmScore >= 80)"
);

fs.writeFileSync('multiAgentSwarm.js', content);
