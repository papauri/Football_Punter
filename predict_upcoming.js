import { engine, ESPN_LEAGUES } from './engine.js';

const LEAGUES = ESPN_LEAGUES;

async function predictUpcoming() {
  console.log("Fetching upcoming matches for the next 3 days...\n");
  
  const now = new Date();
  const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  const formatYMD = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return '' + y + m + day;
  };
  
  const startStr = formatYMD(now);
  const endStr = formatYMD(future);
  
  for (const league of LEAGUES) {
     const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${startStr}-${endStr}`;
     try {
       const res = await fetch(url);
       const data = await res.json();
       
       if (data.events && data.events.length > 0) {
           console.log(`\n=== ${league.name.toUpperCase()} PREDICTIONS ===`);
           for (const ev of data.events) {
               const comp = ev.competitions?.[0];
               if (comp && ev.status?.type?.name === 'STATUS_SCHEDULED') {
                   const home = comp.competitors.find(c => c.homeAway === 'home')?.team?.displayName;
                   const away = comp.competitors.find(c => c.homeAway === 'away')?.team?.displayName;
                   
                   if (home && away) {
                       const probs = engine.computeDixonColesProbabilities(home, away, {});
                       console.log(`${home} vs ${away}`);
                       console.log(`  Predicted Winner : ${probs.predictedWinner}`);
                       console.log(`  Probabilities    : Home ${probs.home.toFixed(1)}% | Draw ${probs.draw.toFixed(1)}% | Away ${probs.away.toFixed(1)}%`);
                       console.log(`  Expected Goals   : Home ${probs.lambda.toFixed(2)} | Away ${probs.mu.toFixed(2)}`);
                       console.log('--------------------------------------------------');
                   }
               }
           }
       }
     } catch (err) {
       // ignore
     }
  }
}

predictUpcoming();
