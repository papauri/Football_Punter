// Understat scraper using standard HTTP fetch without native browser dependencies

const LEAGUES = {
  'EPL': 'EPL',
  'La_liga': 'La_liga',
  'Bundesliga': 'Bundesliga',
  'Serie_A': 'Serie_A',
  'Ligue_1': 'Ligue_1',
  'RFPL': 'RFPL'
};

export async function fetchUnderstatData() {
  const advancedStats = {};

  for (const [leagueName, understatId] of Object.entries(LEAGUES)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://understat.com/league/${understatId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      // The data is embedded inside a script tag: var teamsData = JSON.parse('...');
      const match = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
      if (match && match[1]) {
        const decoded = match[1].replace(/\\x([\dA-F]{2})/gi, (m, grp) => String.fromCharCode(parseInt(grp, 16)));
        const teamsData = JSON.parse(decoded);

        for (const teamId of Object.keys(teamsData)) {
          const team = teamsData[teamId];
          const title = team.title;
          const history = team.history || [];

          // Calculate rolling metrics based on the last 5 matches
          const last5 = history.slice(-5);
          let totalXG = 0;
          let totalXGA = 0;

          last5.forEach(match => {
            totalXG += (match.xG || 0);
            totalXGA += (match.xGA || 0);
          });

          const avgXG = last5.length > 0 ? (totalXG / last5.length) : 1.5;
          const avgXGA = last5.length > 0 ? (totalXGA / last5.length) : 1.5;

          advancedStats[title] = {
            attack: parseFloat(avgXG.toFixed(2)),
            defense: parseFloat(avgXGA.toFixed(2)),
            xGForm: parseFloat(avgXG.toFixed(2)),
            historyLength: history.length
          };
        }
      }
    } catch (err) {
      console.warn(`[Scraper] Notice for ${leagueName}: ${err.message}`);
    }
  }

  return advancedStats;
}
