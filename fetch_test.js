

const LEAGUES = [
  { code: 'eng.1', name: 'Premier League' }
];

async function testFetch() {
  let matches = [];
  const now = new Date();
  
  // We'll just test pulling data month by month for the last 6 months for EPL
  for (let i = 0; i < 6; i++) {
     const end = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
     const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
     
     const formatYMD = (date) => {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return '' + y + m + day;
      };
      
     const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${formatYMD(start)}-${formatYMD(end)}`;
     try {
       const res = await fetch(url);
       const data = await res.json();
       if (data.events) matches.push(...data.events);
     } catch (err) {
       console.log("Error:", err.message);
     }
  }
  console.log(`Fetched ${matches.length} EPL matches over 6 months`);
}

testFetch();
