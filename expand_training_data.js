import fs from 'fs';

const COMPETITIONS = [
  // 1. Newly Added Solid Expansions
  { code: 'ksa.1', name: 'Saudi Pro League', type: 'league', anchors: ['20241015', '20231015', '20221015'] },
  { code: 'gre.1', name: 'Greek Super League', type: 'league', anchors: ['20241015', '20231015', '20221015'] },
  { code: 'irl.1', name: 'Irish Premier Division', type: 'league', anchors: ['20240515', '20230515', '20220515'] },
  { code: 'tur.1', name: 'Turkish Super Lig', type: 'league', anchors: ['20241015', '20231015', '20221015'] },
  { code: 'uefa.nations', name: 'UEFA Nations League', type: 'cup', anchors: ['20240905', '20241011', '20241114', '20220605', '20220923'] },
  { code: 'uefa.euro', name: 'UEFA European Championship', type: 'cup', anchors: ['20240615', '20210615'] },
  { code: 'uefa.euroq', name: 'UEFA European Championship Qualifying', type: 'cup', anchors: ['20230325', '20230617', '20230908', '20231013', '20231118'] },
  { code: 'fifa.world', name: 'FIFA World Cup', type: 'cup', anchors: ['20221122', '20221201', '20221210'] },

  // 2. Core European Domestic Competitions
  { code: 'eng.1', name: 'Premier League', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'esp.1', name: 'LaLiga', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'ger.1', name: 'Bundesliga', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'ita.1', name: 'Serie A', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'fra.1', name: 'Ligue 1', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'ned.1', name: 'Eredivisie', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'por.1', name: 'Primeira Liga', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'sco.1', name: 'Scottish Premiership', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },
  { code: 'bel.1', name: 'Belgian Pro League', type: 'league', anchors: ['20241015', '20231015', '20221015', '20211015'] },

  // 3. UEFA Club Competitions
  { code: 'uefa.champions', name: 'UEFA Champions League', type: 'cup', anchors: ['20241001', '20231003', '20221004', '20211019'] },
  { code: 'uefa.europa', name: 'UEFA Europa League', type: 'cup', anchors: ['20241003', '20231005', '20221006', '20211021'] },
  { code: 'uefa.europa.conf', name: 'UEFA Conference League', type: 'cup', anchors: ['20241003', '20231005', '20221006', '20211021'] },
  { code: 'uefa.super_cup', name: 'UEFA Super Cup', type: 'cup', anchors: ['20240814', '20230816', '20220810', '20210811'] },

  // 4. Domestic Knockout Cups
  { code: 'eng.fa', name: 'English FA Cup', type: 'cup', anchors: ['20240106', '20230107', '20220108'] },
  { code: 'eng.league_cup', name: 'English Carabao Cup', type: 'cup', anchors: ['20240924', '20230926', '20220920'] },
  { code: 'ger.dfb_pokal', name: 'DFB-Pokal', type: 'cup', anchors: ['20240816', '20230811', '20220729'] },
  { code: 'esp.copa_del_rey', name: 'Copa del Rey', type: 'cup', anchors: ['20240106', '20230103', '20220105'] },
  { code: 'ita.coppa_italia', name: 'Coppa Italia', type: 'cup', anchors: ['20240103', '20230110', '20220112'] },
  { code: 'ned.cup', name: 'KNVB Beker', type: 'cup', anchors: ['20240116', '20230110', '20220118'] }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchScoreboard(leagueCode, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function runExpansion() {
  console.log('========================================================');
  console.log('QUANTITATIVE EXPANSION OF HISTORICAL TRAINING DATA');
  console.log('========================================================\n');

  // Step 1: Backup existing dataset
  const rawExisting = fs.readFileSync('training_data.json', 'utf8');
  fs.writeFileSync('training_data.json.bak', rawExisting, 'utf8');
  const existingMatches = JSON.parse(rawExisting);
  console.log(`Loaded ${existingMatches.length} existing historical matches (Backup saved to training_data.json.bak).`);

  const seenKeys = new Set();
  existingMatches.forEach(m => {
    const h = (m.home || '').toLowerCase().trim();
    const a = (m.away || '').toLowerCase().trim();
    const d = (m.date || '').slice(0, 10);
    if (h && a && d) {
      seenKeys.add(`${h}_vs_${a}_${d}`);
    }
  });

  const newMatches = [];
  let totalNewAdded = 0;

  for (const comp of COMPETITIONS) {
    console.log(`\n[Harvesting] ${comp.name} (${comp.code})...`);
    const compDates = new Set();

    for (const anchor of comp.anchors) {
      const data = await fetchScoreboard(comp.code, anchor);
      if (!data) continue;
      const cal = data.leagues?.[0]?.calendar || [];
      cal.forEach(rawDate => {
        if (typeof rawDate === 'string' && rawDate.length >= 10) {
          const dateStr = rawDate.slice(0, 10).replace(/-/g, '');
          compDates.add(dateStr);
        }
      });
      await sleep(60);
    }

    const dateList = Array.from(compDates).sort();
    console.log(`  -> Indexed ${dateList.length} distinct matchdays for ${comp.name}. Fetching scoreboards...`);

    let compAdded = 0;
    // Process in concurrent batches of 6
    const BATCH_SIZE = 6;
    for (let i = 0; i < dateList.length; i += BATCH_SIZE) {
      const batch = dateList.slice(i, i + BATCH_SIZE);
      const promises = batch.map(d => fetchScoreboard(comp.code, d));
      const results = await Promise.all(promises);

      for (const dayData of results) {
        if (!dayData || !Array.isArray(dayData.events)) continue;

        for (const ev of dayData.events) {
          const compEvent = ev.competitions?.[0];
          const isCompleted = ev.status?.type?.name === 'STATUS_FULL_TIME' || 
                              compEvent?.status?.type?.completed || 
                              ev.status?.type?.detail?.includes('FT') ||
                              ev.status?.type?.detail?.includes('AET') ||
                              ev.status?.type?.detail?.includes('Pen');

          if (!isCompleted) continue;

          const homeComp = compEvent?.competitors?.find(c => c.homeAway === 'home');
          const awayComp = compEvent?.competitors?.find(c => c.homeAway === 'away');
          if (!homeComp || !awayComp) continue;

          const hName = homeComp.team?.displayName;
          const aName = awayComp.team?.displayName;
          if (!hName || !aName) continue;

          const hScore = parseInt(homeComp.score || 0, 10);
          const aScore = parseInt(awayComp.score || 0, 10);
          if (isNaN(hScore) || isNaN(aScore)) continue;

          const evDate = ev.date || new Date().toISOString();
          const dPart = evDate.slice(0, 10);
          const key = `${hName.toLowerCase().trim()}_vs_${aName.toLowerCase().trim()}_${dPart}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);

            const actualWinner = hScore > aScore ? 'HOME' : aScore > hScore ? 'AWAY' : 'DRAW';
            const cleanHome = hName.replace(/\s+/g, '_').toLowerCase();
            const cleanAway = aName.replace(/\s+/g, '_').toLowerCase();

            const matchRecord = {
              id: ev.id ? `espn_${ev.id}` : `espn_${cleanHome}_${cleanAway}_${dPart.replace(/-/g, '')}`,
              home: hName,
              away: aName,
              homeScore: hScore,
              awayScore: aScore,
              league: comp.name,
              leagueCode: comp.code,
              isCup: comp.type === 'cup',
              date: evDate,
              timestamp: new Date(evDate).getTime() || Date.now(),
              goals: {
                home: hScore,
                away: aScore
              },
              actualWinner: actualWinner
            };

            newMatches.push(matchRecord);
            compAdded++;
            totalNewAdded++;
          }
        }
      }
      await sleep(50);
    }
    console.log(`  -> Added ${compAdded} net new verified matches for ${comp.name}`);
  }

  console.log('\n========================================================');
  console.log(`EXPANSION SUMMARY`);
  console.log(`Original Dataset: ${existingMatches.length} matches`);
  console.log(`Net New Matches Harvested: ${totalNewAdded} matches`);
  const finalDataset = [...existingMatches, ...newMatches];
  finalDataset.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  console.log(`Total Expanded Dataset: ${finalDataset.length} matches`);
  console.log('========================================================\n');

  fs.writeFileSync('training_data.json', JSON.stringify(finalDataset, null, 2), 'utf8');
  console.log('Successfully saved expanded training_data.json to disk!');
}

runExpansion();
