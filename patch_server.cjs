const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

if (!content.includes('/api/historical-30d')) {
    content = content.replace(
        "app.get('/api/state', (req, res) => {",
        `app.get('/api/historical-30d', (req, res) => {
    if (!engine || !engine.historicalMatches) return res.json({ matches: [] });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const recentMatches = engine.historicalMatches.filter(m => {
        const d = m.dateIso || m.date || m.utcDate;
        if (!d) return false;
        return new Date(d) >= thirtyDaysAgo;
    });
    res.json({ matches: recentMatches });
});

app.get('/api/state', (req, res) => {`
    );
    fs.writeFileSync('server.js', content);
    console.log("Added /api/historical-30d");
}
