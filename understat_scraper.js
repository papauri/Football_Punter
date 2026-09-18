import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const LEAGUES = {
  'EPL': 'EPL',
  'La_liga': 'La_liga',
  'Bundesliga': 'Bundesliga',
  'Serie_A': 'Serie_A',
  'Ligue_1': 'Ligue_1',
  'RFPL': 'RFPL'
};

export async function fetchUnderstatData() {
  console.log('[Scraper] Launching Headless Browser to bypass Cloudflare for Understat...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    // Mask as standard browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const advancedStats = {};

    for (const [leagueName, understatId] of Object.entries(LEAGUES)) {
      console.log(`[Scraper] Fetching ${leagueName} advanced stats...`);
      try {
        await page.goto(`https://understat.com/league/${understatId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for the scripts to load
        const html = await page.content();
        
        // The data is embedded inside a script tag: var teamsData = JSON.parse('...');
        const match = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
        if (match && match[1]) {
          const decoded = match[1].replace(/\\x([\dA-F]{2})/gi, (m, grp) => String.fromCharCode(parseInt(grp, 16)));
          const teamsData = JSON.parse(decoded);
          
          for (const teamId of Object.keys(teamsData)) {
            const team = teamsData[teamId];
            const title = team.title;
            const history = team.history;
            
            // Calculate rolling metrics based on the last 5 matches
            const last5 = history.slice(-5);
            let totalXG = 0;
            let totalXGA = 0;
            
            last5.forEach(match => {
                totalXG += match.xG;
                totalXGA += match.xGA;
            });
            
            const avgXG = last5.length > 0 ? (totalXG / last5.length) : 1.5;
            const avgXGA = last5.length > 0 ? (totalXGA / last5.length) : 1.5;
            
            // Map Understat team names to our internal standardized names if needed
            advancedStats[title] = {
                attack: parseFloat(avgXG.toFixed(2)),
                defense: parseFloat(avgXGA.toFixed(2)),
                xGForm: parseFloat(avgXG.toFixed(2)), // Latest attacking form
                historyLength: history.length
            };
          }
        }
      } catch (err) {
        console.error(`[Scraper] Failed to fetch ${leagueName}: ${err.message}`);
      }
    }
    
    return advancedStats;
  } catch (error) {
    console.error('[Scraper] Critical error:', error);
    return {};
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// For testing purposes
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchUnderstatData().then(data => {
    console.log(`Scraped ${Object.keys(data).length} teams.`);
    console.log('Sample Data (Arsenal):', data['Arsenal']);
    process.exit(0);
  });
}
