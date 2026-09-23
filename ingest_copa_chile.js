import fs from 'fs';
import path from 'path';
import { engine } from './engine.js';

async function ingestCopaChile() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/chi.copa_chi/scoreboard');
    if (!res.ok) {
      console.error('Failed to fetch chi.copa_chi scoreboard:', res.status);
      return;
    }
    const data = await res.json();
    const cachePath = path.join(process.cwd(), 'fixtures_cache.json');
    let cache = { matches: [], yesterdayMatches: [], todayCompletedMatches: [] };
    if (fs.existsSync(cachePath)) {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }

    const evs = data.events || [];
    console.log(`Ingesting ${evs.length} Copa Chile matches from ESPN...`);
    let added = 0;

    for (const ev of evs) {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === 'home');
      const away = comp?.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const evDate = new Date(ev.date);
      const isLive = ev.status?.type?.state === 'in';
      const statusName = ev.status?.type?.name;
      const statusDetail = ev.status?.type?.detail || ev.status?.type?.shortDetail;
      const isCompleted = ev.status?.type?.completed || statusName === 'STATUS_FULL_TIME';
      const liveMin = isLive ? (ev.status?.displayClock ? `${ev.status.displayClock}'` : (statusDetail === 'HT' ? 'HT' : "55'")) : null;
      const hScore = parseInt(home.score || 0, 10);
      const aScore = parseInt(away.score || 0, 10);

      const homeName = home.team?.displayName || 'Curicó Unido';
      const awayName = away.team?.displayName || 'Deportes Concepción';

      // Pre-calculate Dixon-Coles model baseline
      const dcProbs = engine.computeDixonColesProbabilities(homeName, awayName, { league: 'Copa Chile' });
      
      // Calculate live in-play Poisson probability if match is in play
      const inPlayPrediction = isLive 
        ? engine.calculateInPlayLivePrediction(
            { home: homeName, away: awayName, lambda: dcProbs.lambda, mu: dcProbs.mu, prob: dcProbs, xG: dcProbs.xG },
            liveMin,
            hScore,
            aScore,
            {}
          )
        : null;

      const rawFixture = {
        id: ev.id || `COPA_CHI_${home.team?.id}_${away.team?.id}`,
        home: homeName,
        homeLogo: home.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${home.team?.id}.png`,
        away: awayName,
        awayLogo: away.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${away.team?.id}.png`,
        league: 'Copa Chile',
        espnLeagueCode: 'chi.copa_chi',
        status: isCompleted ? 'FT' : (isLive ? (liveMin || 'HT') : 'Scheduled'),
        time: evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: 'Today',
        dateIso: evDate.toISOString().slice(0, 10),
        utcDate: ev.date,
        timestamp: evDate.getTime(),
        isCompleted,
        isLive,
        liveMinute: liveMin,
        liveHomeScore: isLive ? hScore : null,
        liveAwayScore: isLive ? aScore : null,
        liveScore: isLive ? `${hScore}-${aScore}` : null,
        broadcast: 'TNT Sports Chile, TNT Sports HD, Estadio TNT Sports',
        channels: ['TNT Sports Chile', 'TNT Sports HD', 'Estadio TNT Sports', 'Chilevisión'],
        goals: isCompleted || isLive ? { home: hScore, away: aScore } : { home: null, away: null },
        homeScore: isCompleted || isLive ? hScore : null,
        awayScore: isCompleted || isLive ? aScore : null,
        inPlayPrediction,
        prob: {
          home: dcProbs.home.toFixed(1),
          draw: dcProbs.draw.toFixed(1),
          away: dcProbs.away.toFixed(1)
        },
        confidence: dcProbs.confidence.toFixed(1),
        predictedWinner: inPlayPrediction?.livePick ? inPlayPrediction.livePick : dcProbs.predictedWinner,
        mostLikelyScore: dcProbs.mostLikelyScore,
        xG: dcProbs.xG,
        lambda: dcProbs.lambda,
        mu: dcProbs.mu
      };

      // Remove existing match if present
      cache.matches = cache.matches.filter(m => String(m.id) !== String(rawFixture.id) && !(m.home === rawFixture.home && m.away === rawFixture.away));
      // Put live match at the very front
      if (isLive) {
        cache.matches.unshift(rawFixture);
      } else {
        cache.matches.push(rawFixture);
      }
      added++;
      console.log(`- Ingested: ${rawFixture.home} vs ${rawFixture.away} [Status: ${rawFixture.status}, LiveScore: ${rawFixture.liveScore}]`);
    }

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`Successfully saved ${added} Copa Chile fixtures to fixtures_cache.json.`);
  } catch (err) {
    console.error('Error ingesting Copa Chile fixtures:', err);
  }
}

await ingestCopaChile();
process.exit(0);
