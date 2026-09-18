async function testUnderstat() {
    const res = await fetch('https://understat.com/league/EPL', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const match = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
    if (match) {
        const decoded = match[1].replace(/\\x([\dA-F]{2})/gi, (m, grp) => String.fromCharCode(parseInt(grp, 16)));
        const parsed = JSON.parse(decoded);
        const teamIds = Object.keys(parsed);
        if (teamIds.length > 0) {
            const firstTeam = parsed[teamIds[0]];
            console.log('Successfully extracted data for', firstTeam.title);
            console.log('Sample data history length:', firstTeam.history.length);
        }
    } else {
        console.log('Could not find teamsData script tag. HTML length:', html.length);
    }
}
testUnderstat();
