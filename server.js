import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { engine } from './engine.js';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Immediate payload parsing error handler
  app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      console.warn('[Server] PayloadTooLargeError caught:', err.message);
      return res.status(413).json({
        success: false,
        error: 'PayloadTooLargeError: request entity too large. The request body exceeded the maximum limit.'
      });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      console.warn('[Server] Malformed JSON payload caught:', err.message);
      return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
    }
    next(err);
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/historical-30d', (req, res) => {
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
        const dcProbs = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
        const hG = m.homeScore ?? m.goals?.home;
        const aG = m.awayScore ?? m.goals?.away;
        const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');
        const smartHit = (hG != null && aG != null) ? engine.evaluateHit(dcProbs, hG, aG) : null;
        const isHit = smartHit !== null ? smartHit : (dcProbs.predictedWinner === actualWinner);
        const isPush = smartHit === null && (dcProbs.smartMarket?.pick?.includes('DNB') || false);
        const isPass = dcProbs.smartMarket?.pick === 'PASS';

        return {
            ...m,
            actualWinner,
            actualScore: (hG != null && aG != null) ? `${hG}-${aG}` : m.actualScore,
            predictedWinner: dcProbs.predictedWinner,
            isHit,
            smartHit,
            isPush,
            isPass,
            smartMarket: dcProbs.smartMarket,
            binaryModel: dcProbs.binaryModel,
            disruptionModel: dcProbs.disruptionModel,
            confidence: dcProbs.confidence,
            prob: {
              home: typeof dcProbs.home === 'number' ? dcProbs.home.toFixed(1) : '33.3',
              draw: typeof dcProbs.draw === 'number' ? dcProbs.draw.toFixed(1) : '33.4',
              away: typeof dcProbs.away === 'number' ? dcProbs.away.toFixed(1) : '33.3'
            }
        };
    });

    res.json({ matches: populated });
});

app.get('/api/state', (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.json(engine.getState());
    } catch (err) {
      console.error("Error generating state:", err);
      res.status(500).json({ error: 'Internal Engine Error', message: err.message });
    }
  });

  app.post('/api/scrape', async (req, res) => {
    try {
      engine.isFetching = false; // Reset lock to allow on-demand user scrape
      await engine.scrapeESPNData();
      res.json({
        success: true,
        matchCount: engine.matches?.length || 0,
        historicalCount: engine.historicalMatches?.length || 0,
        trainingStats: engine.trainingStats,
        message: `Successfully scraped latest live fixtures and completed scoreboards. ${engine.matches?.length || 0} upcoming fixtures loaded.`
      });
    } catch (error) {
      console.error("Scrape error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/retrain', async (req, res) => {
    try {
      await engine.runTrainingCycle();
      await engine.runScoreSuperAgentTrainingCycle();
      res.json({
        success: true,
        trainingStats: engine.trainingStats,
        scoreTrainingStats: engine.scoreTrainingStats,
        message: `Model recalibrated across ${engine.trainingStats?.sampleCount || 0} matches with ${engine.trainingStats?.accuracy || 0}% accuracy.`
      });
    } catch (error) {
      console.error("Retrain error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/retrain-score-agent', async (req, res) => {
    try {
      const scoreStats = await engine.runScoreSuperAgentTrainingCycle();
      res.json({ success: true, scoreTrainingStats: scoreStats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/deep-retrain-patch', async (req, res) => {
    try {
      const result = await engine.runDeepOptimizationAndSelfPatch();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/self-reflect', async (req, res) => {
    const result = await engine.runSelfPromptingReflectionCycle();
    res.json({ 
      success: true, 
      reflectionStats: engine.reflectionStats,
      selfReflections: engine.selfReflections,
      mistakePostMortems: engine.mistakePostMortems,
      result
    });
  });

  app.post('/api/autonomous-patch', async (req, res) => {
    try {
      const result = await engine.runAutonomousMissPatching(req.body || {});
      res.json({
        success: true,
        result,
        telemetry: engine.patchTelemetry,
        governorState: engine.patchGovernorState,
        autonomousPatches: engine.autonomousPatches
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/autonomous-patch/governor-status', (req, res) => {
    try {
      const govState = engine.swarmOrchestrator?.patchGovernorAgent?.evaluateState() || engine.patchGovernorState;
      res.json({
        success: true,
        governorState: govState,
        telemetry: engine.patchTelemetry,
        hyperparameters: engine.hyperparameters
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/deep-ai-research', async (req, res) => {
    try {
      const { matchId, ...customOptions } = req.body || {};
      const research = await engine.runSingleMatchDeepAiResearch(matchId, customOptions);
      res.json({ success: true, research });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/props-specials', async (req, res) => {
    try {
      const forceRefresh = req.body?.forceRefresh === true;
      const cacheKey = JSON.stringify({ limit: req.body?.limit || 12 });
      const now = Date.now();
      
      // Cache valid for 30 minutes (1800000 ms) unless forceRefresh
      if (!forceRefresh && propsSpecialsCache.has(cacheKey)) {
        const cached = propsSpecialsCache.get(cacheKey);
        if (now - cached.timestamp < 1800000) {
          return res.json({ success: true, result: cached.result, fromCache: true });
        }
      }

      if (!engine.matches || engine.matches.length === 0) {
        try {
          await engine.scrapeESPNData();
        } catch (e) {
          console.warn('[PropsSpecials] Match pre-scrape warning:', e.message);
        }
      }

      const result = await engine.runPropsSpecialsDeepAnalysis(req.body);
      
      if (result && result.status === 'SUCCESS' && result.insights?.length > 0) {
        propsSpecialsCache.set(cacheKey, { result, timestamp: now });
      }

      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/props-accumulator', async (req, res) => {
    try {
      const { legs = 3, forceRefresh = false, matches } = req.body || {};
      const cacheKey = `props_acc_${legs}_${(matches || []).length}`;
      const now = Date.now();

      if (!forceRefresh && propsSpecialsCache.has(cacheKey)) {
        const cached = propsSpecialsCache.get(cacheKey);
        if (now - cached.timestamp < 10 * 60 * 1000) {
          return res.json({ success: true, result: cached.result, cached: true });
        }
      }

      if (!engine.matches || engine.matches.length === 0) {
        try {
          await engine.scrapeESPNData();
        } catch (e) {
          console.warn('[PropsAcca] Pre-scrape warning:', e.message);
        }
      }

      const result = await engine.generateOptimalPropsAccumulator({ legs, matches });
      if (result.success && result.slip) {
        propsSpecialsCache.set(cacheKey, { result, timestamp: now });
      }

      res.json({ success: true, result });
    } catch (error) {
      console.error('[PropsAcca] Generation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/props-accumulator', async (req, res) => {
    try {
      const legs = parseInt(req.query.legs || '3', 10);
      const result = await engine.generateOptimalPropsAccumulator({ legs });
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/rollback-patch', (req, res) => {
    try {
      const { patchId } = req.body || {};
      if (!patchId) return res.status(400).json({ success: false, error: 'patchId is required' });
      const rollbackResult = engine.rollbackAutonomousPatch(patchId);
      res.json(rollbackResult);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/autonomous-patches', (req, res) => {
    const state = engine.getState();
    res.json({
      success: true,
      patches: state.autonomousPatches || [],
      telemetry: engine.patchTelemetry || {},
      snapshotsCount: engine.patchSnapshots ? engine.patchSnapshots.size : 0
    });
  });

  app.get('/api/swarm', (req, res) => {
    try {
      res.json({
        success: true,
        swarm: engine.swarmOrchestrator ? engine.swarmOrchestrator.getState() : null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/swarm/run-cycle', async (req, res) => {
    try {
      if (engine.swarmOrchestrator) {
        await engine.swarmOrchestrator.runSimultaneousCycle();
      }
      res.json({
        success: true,
        swarm: engine.swarmOrchestrator ? engine.swarmOrchestrator.getState() : null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/swarm/match/:id', (req, res) => {
    try {
      const matchId = req.params.id;
      const data = engine.swarmOrchestrator ? engine.swarmOrchestrator.getSwarmDataForMatch(matchId) : null;
      res.json({ success: true, matchId, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // In-memory cache for date queries
  const serverDateCache = new Map();
  // In-memory cache for Props & Specials AI results
  const propsSpecialsCache = new Map();

  app.get('/api/fetch-date', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'Date query param is required (YYYY-MM-DD)' });

    // Return cached results if available within 5 minutes (or indefinitely for past dates)
    const cached = serverDateCache.get(date);
    const now = Date.now();
    const isPastDate = new Date(date).getTime() < new Date().setHours(0, 0, 0, 0);

    if (cached && (isPastDate || (now - cached.timestamp < 300000))) {
      return res.json({ success: true, date, count: cached.matches.length, matches: cached.matches, fromCache: true });
    }

    try {
      const matches = await engine.fetchMatchesForDate(date);
      serverDateCache.set(date, { matches, timestamp: now });
      res.json({ success: true, date, count: matches.length, matches });
    } catch (err) {
      console.error(`Error in /api/fetch-date for ${date}:`, err);

      // Attempt fallback from historical matches or state
      const rawFallback = (engine.historicalMatches || []).concat(engine.yesterdayMatches || []).concat(engine.matches || [])
        .filter(x => (x.date && x.date.startsWith(date)) || (x.dateIso && x.dateIso.startsWith(date)));

      const fallback = rawFallback.map(m => {
        if (m.predictedWinner && m.smartMarket && m.isHit !== undefined) return m;
        const dcProbs = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league, odds: m.odds });
        const hG = m.homeScore ?? m.goals?.home;
        const aG = m.awayScore ?? m.goals?.away;
        const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : null);
        const smartHit = (hG != null && aG != null) ? engine.evaluateHit(dcProbs, hG, aG) : null;
        const isHit = smartHit !== null ? smartHit : (actualWinner && dcProbs.predictedWinner ? dcProbs.predictedWinner === actualWinner : null);
        const isPush = smartHit === null && (dcProbs.smartMarket?.pick?.includes('DNB') || false);
        const isPass = dcProbs.smartMarket?.pick === 'PASS';

        return {
          ...m,
          actualWinner,
          actualScore: (hG != null && aG != null) ? `${hG}-${aG}` : m.actualScore,
          predictedWinner: dcProbs.predictedWinner,
          predictedScore: dcProbs.mostLikelyScore,
          isHit,
          smartHit,
          isPush,
          isPass,
          smartMarket: dcProbs.smartMarket,
          binaryModel: dcProbs.binaryModel,
          disruptionModel: dcProbs.disruptionModel,
          confidence: dcProbs.confidence,
          prob: {
            home: typeof dcProbs.home === 'number' ? dcProbs.home.toFixed(1) : '33.3',
            draw: typeof dcProbs.draw === 'number' ? dcProbs.draw.toFixed(1) : '33.4',
            away: typeof dcProbs.away === 'number' ? dcProbs.away.toFixed(1) : '33.3'
          }
        };
      });

      res.json({
        success: true,
        date,
        count: fallback.length,
        matches: fallback,
        fallback: true,
        notice: 'Served from internal historical repository with live calibrated evaluations.'
      });
    }
  });

  app.get('/api/match-lineup', async (req, res) => {
    try {
      const { matchId, league, refresh } = req.query;
      if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });
      const forceRefresh = refresh === 'true' || refresh === '1';
      const lineup = await engine.fetchMatchLineup(matchId, league, forceRefresh);
      res.json(lineup);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/bankroll-config', (req, res) => {
    try {
      const { bankrollEuro, kellyFraction } = req.body;
      const config = engine.setBankrollConfig(bankrollEuro, kellyFraction);
      res.json({ success: true, config });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/tuning-config', async (req, res) => {
    try {
      const config = await engine.setTuningConfig(req.body);
      res.json({ success: true, config, state: engine.getState() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/ai-config', (req, res) => {
    res.json(engine.getAiConfigPublic());
  });

  app.post('/api/ai-config', (req, res) => {
    const { provider, key, model, isPrimary } = req.body;
    if (provider) {
      engine.setProviderConfig(provider, key, model, isPrimary);
      res.json({ success: true, config: engine.getAiConfigPublic() });
    } else {
      res.status(400).json({ error: 'Provider is required' });
    }
  });

  app.post('/api/key', (req, res) => {
    const { apiKey, model, provider, isPrimary } = req.body;
    
    if (apiKey && model) {
      if (provider) {
        engine.setProviderConfig(provider, apiKey, model, isPrimary !== false);
      } else {
        engine.updateAiConfig(apiKey, model);
      }
      res.json({ success: true, config: engine.getAiConfigPublic() });
    } else {
      res.status(400).json({ error: 'Key and model are required' });
    }
  });

  app.post('/api/analyze-match', async (req, res) => {
    try {
      const { home, away, league, prob, date } = req.body;
      const analysis = await engine.analyzeMatchWithNews(home, away, league, prob, date);
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/analyze-accumulator', async (req, res) => {
    try {
      const { picks, suggestedMatches } = req.body;
      const analysis = await engine.analyzeAccumulator(picks, suggestedMatches);
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/clear-logs', (req, res) => {
    engine.clearLogs();
    res.json({ success: true });
  });

  app.post('/api/autonomous-agent', (req, res) => {
    const { action } = req.body;
    if (action === 'start') {
      engine.startAutonomousAgent();
    } else if (action === 'stop') {
      engine.stopAutonomousAgent();
    }
    res.json({ success: true, status: engine.agentStats?.status || 'Offline' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Engine running on http://localhost:${PORT}`);
    // Start continuous autonomous agent in the background after server is listening
    setTimeout(() => {
      engine.startAutonomousAgent();
    }, 1000);
  });
}

startServer();
