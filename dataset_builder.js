import fs from 'fs';

const COMPETITIONS = [
  // English Leagues & Cups
  { code: 'eng.1', name: 'Premier League', type: 'league' },
  { code: 'eng.fa', name: 'English FA Cup', type: 'cup' },
  { code: 'eng.league_cup', name: 'English Carabao Cup', type: 'cup' },
  { code: 'eng.2', name: 'Championship', type: 'league' },

  // Spanish Leagues & Cups
  { code: 'esp.1', name: 'LaLiga', type: 'league' },
  { code: 'esp.copa_del_rey', name: 'Copa del Rey', type: 'cup' },

  // Italian Leagues & Cups
  { code: 'ita.1', name: 'Serie A', type: 'league' },
  { code: 'ita.coppa_italia', name: 'Coppa Italia', type: 'cup' },

  // German Leagues & Cups
  { code: 'ger.1', name: 'Bundesliga', type: 'league' },
  { code: 'ger.dfb_pokal', name: 'DFB-Pokal', type: 'cup' },

  // French Leagues & Cups
  { code: 'fra.1', name: 'Ligue 1', type: 'league' },

  // European Tournaments
  { code: 'uefa.champions', name: 'UEFA Champions League', type: 'cup' },
  { code: 'uefa.europa', name: 'UEFA Europa League', type: 'cup' },
  { code: 'uefa.europa.conf', name: 'UEFA Conference League', type: 'cup' },

  // Other Major Global Leagues
  { code: 'por.1', name: 'Primeira Liga', type: 'league' },
  { code: 'ned.1', name: 'Eredivisie', type: 'league' },
  { code: 'sco.1', name: 'Scottish Premiership', type: 'league' },
  { code: 'tur.1', name: 'Turkish Super Lig', type: 'league' },
  { code: 'bel.1', name: 'Belgian Pro League', type: 'league' },
  { code: 'bra.1', name: 'Brasileirão', type: 'league' },
  { code: 'arg.1', name: 'Liga Profesional', type: 'league' },
  { code: 'usa.1', name: 'MLS', type: 'league' },
  { code: 'mex.1', name: 'Liga MX', type: 'league' },
  { code: 'aut.1', name: 'Austrian Bundesliga', type: 'league' },
  { code: 'sui.1', name: 'Swiss Super League', type: 'league' },
  { code: 'den.1', name: 'Danish Superliga', type: 'league' },
  { code: 'gre.1', name: 'Greek Super League', type: 'league' },
  { code: 'ksa.1', name: 'Saudi Pro League', type: 'league' },
  { code: 'nor.1', name: 'Norwegian Eliteserien', type: 'league' },
  { code: 'swe.1', name: 'Swedish Allsvenskan', type: 'league' },
  { code: 'jpn.1', name: 'Japanese J1 League', type: 'league' },
  { code: 'uefa.nations', name: 'UEFA Nations League', type: 'cup' },
  { code: 'fifa.worldq.uefa', name: 'UEFA World Cup Qualifiers', type: 'cup' },
  { code: 'fifa.worldq.conmebol', name: 'CONMEBOL World Cup Qualifiers', type: 'cup' },
  { code: 'uefa.super_cup', name: 'UEFA Super Cup', type: 'cup' },
  { code: 'fifa.cwc', name: 'FIFA Club World Cup', type: 'cup' }
];

async function buildDataset() {
  let matches = [];
  const now = new Date();
  const CHUNKS = 60; // 60 months (5 years) of historical match depth
  
  console.log(`Starting dataset build across ${COMPETITIONS.length} competitions (including FA Cup & domestic cups)...`);

  for (const compMeta of COMPETITIONS) {
    console.log(`[Ingest] Fetching up to 18 months of data for ${compMeta.name} (${compMeta.code})...`);
    let compMatches = 0;

    for (let i = 0; i < CHUNKS; i++) {
      const end = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const formatYMD = (date) => {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return '' + y + m + day;
      };
      
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${compMeta.code}/scoreboard?dates=${formatYMD(start)}-${formatYMD(end)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        
        if (data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            const comp = ev.competitions?.[0];
            const isCompleted = ev.status?.type?.name === 'STATUS_FULL_TIME' || 
                                comp?.status?.type?.completed || 
                                ev.status?.type?.detail?.includes('FT') ||
                                ev.status?.type?.detail?.includes('AET') ||
                                ev.status?.type?.detail?.includes('Pen');

            if (isCompleted) {
              const home = comp?.competitors?.find(c => c.homeAway === 'home');
              const away = comp?.competitors?.find(c => c.homeAway === 'away');
              
              if (home && away && home.score !== undefined && away.score !== undefined) {
                const homeScore = parseInt(home.score || 0, 10);
                const awayScore = parseInt(away.score || 0, 10);
                
                matches.push({
                  id: ev.id || `${home.team?.displayName}_${away.team?.displayName}_${ev.date}`,
                  home: home.team?.displayName || 'Home Team',
                  away: away.team?.displayName || 'Away Team',
                  homeScore,
                  awayScore,
                  league: compMeta.name,
                  leagueCode: compMeta.code,
                  isCup: compMeta.type === 'cup',
                  date: ev.date,
                  timestamp: ev.date ? new Date(ev.date).getTime() : 0
                });
                compMatches++;
              }
            }
          }
        }
      } catch (err) {
        // Continue silently on transient chunk failures
      }
    }
    console.log(`  -> Captured ${compMatches} completed matches for ${compMeta.name}`);
  }
  
  // Deduplicate matches based on unique ID / home-away-date
  const uniqueMatches = [];
  const seen = new Set();
  for (const m of matches) {
    const key = `${m.home}-${m.away}-${m.date?.slice(0, 10)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMatches.push(m);
    }
  }

  // Sort chronologically (earliest to latest)
  uniqueMatches.sort((a, b) => a.timestamp - b.timestamp);

  const leagueCount = uniqueMatches.filter(m => !m.isCup).length;
  const cupCount = uniqueMatches.filter(m => m.isCup).length;

  console.log(`\n======================================================`);
  console.log(`DATASET BUILD COMPLETE`);
  console.log(`Total Unique Completed Matches: ${uniqueMatches.length}`);
  console.log(`League Matches: ${leagueCount} | Cup Matches (FA Cup, etc.): ${cupCount}`);
  console.log(`======================================================\n`);

  fs.writeFileSync('training_data.json', JSON.stringify(uniqueMatches, null, 2));
  console.log('Saved to training_data.json successfully!');
}

buildDataset();
