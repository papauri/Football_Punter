const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const replacement = `app.get('/api/historical-30d', (req, res) => {
    if (!engine || !engine.historicalMatches) return res.json({ matches: [] });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const recentMatches = engine.historicalMatches.filter(m => {
        const d = m.dateIso || m.date || m.utcDate;
        if (!d) return false;
        return new Date(d) >= thirtyDaysAgo;
    });

    // Populate predictions for historical matches so the chart has real accuracy data
    const populated = recentMatches.map(m => {
        if (m.predictedWinner) return m; // Already has prediction
        const dcProbs = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
        const actualWinner = m.actualWinner || (m.homeScore > m.awayScore ? 'HOME' : m.awayScore > m.homeScore ? 'AWAY' : 'DRAW');
        return {
            ...m,
            actualWinner,
            predictedWinner: dcProbs.predictedWinner,
            isHit: dcProbs.predictedWinner === actualWinner,
            binaryModel: dcProbs.binaryModel,
            confidence: dcProbs.confidence
        };
    });

    res.json({ matches: populated });
});`;

// Find and replace the existing historical-30d endpoint
content = content.replace(
    /app\.get\('\/api\/historical-30d', \(req, res\) => \{[\s\S]*?res\.json\(\{ matches: recentMatches \}\);\n\}\);/,
    replacement
);

fs.writeFileSync('server.js', content);
console.log("Patched server.js historical-30d");
