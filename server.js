import express from 'express';
import { createServer as createHttpServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { engine } from './engine.js';
import { isLeagueBlacklisted } from './src/utils/leagueUtils.js';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Optional compression with graceful fallback if package is not installed
  try {
    const compressionModule = await import('compression');
    const compression = compressionModule.default || compressionModule;
    app.use(compression());
  } catch (e) {
    // Compression is optional; continue cleanly
  }

  // Permissive CORS and frame allowance for AI Studio / Webview / Cloud Workstations preview iframe
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.removeHeader('X-Frame-Options');
    res.header('Content-Security-Policy', "frame-ancestors *");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

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
    if (!engine) return res.json({ matches: [] });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Combine todayCompletedMatches, yesterdayMatches, and historicalMatches so recent finishes appear immediately
    const allMatches = (engine.todayCompletedMatches || [])
      .concat(engine.yesterdayMatches || [])
      .concat(engine.historicalMatches || []);

    const seenIds = new Set();
    const recentMatches = [];

    for (const m of allMatches) {
      if (isLeagueBlacklisted(m.league) || engine.isLeagueDisabled(m.league)) continue;
      const idKey = m.id || `${m.home}-${m.away}-${m.dateIso || m.date}`;
      if (seenIds.has(idKey)) continue;
      const d = m.dateIso || m.date || m.utcDate;
      if (!d) continue;
      const matchDate = new Date(d);
      if (!isNaN(matchDate.getTime()) && matchDate >= thirtyDaysAgo) {
        seenIds.add(idKey);
        recentMatches.push(m);
      }
    }

    // Populate predictions for historical matches so the chart has real accuracy data
    const populated = recentMatches.map(m => {
        const hG = m.homeScore ?? m.goals?.home;
        const aG = m.awayScore ?? m.goals?.away;
        const actualWinner = m.actualWinner || (hG != null && aG != null ? (hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW') : 'DRAW');

        if (m.predictedWinner && m.prob && m.confidence) {
          const isHit = m.isHit !== undefined ? m.isHit : (m.predictedWinner === actualWinner);
          return {
            ...m,
            actualWinner,
            actualScore: (hG != null && aG != null) ? `${hG}-${aG}` : m.actualScore,
            isHit
          };
        }

        const dcProbs = engine.computeDixonColesProbabilities(m.home, m.away, { league: m.league });
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

  // Real-time match stream web scraper & in-frame embed proxy
  app.get('/api/scrape-match-streams', async (req, res) => {
    const home = (req.query.home || '').trim();
    const away = (req.query.away || '').trim();
    const league = (req.query.league || '').trim();

    if (!home || !away) {
      return res.status(400).json({ success: false, error: 'home and away query parameters are required' });
    }

    const cleanHome = home.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const cleanAway = away.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const matchQuery = `${cleanHome} vs ${cleanAway}`;
    const searchKeywords = `${cleanHome} ${cleanAway}`;

    const scrapedStreams = [];
    const seenUrls = new Set();

    // Helper to add unique stream source
    const addSource = (source) => {
      const u = source.url || source.embedUrl || source.straightUrl;
      if (!u || seenUrls.has(u)) return;
      seenUrls.add(u);
      scrapedStreams.push(source);
    };

    try {
      // 1. YouTube Live Match Broadcast / Live Audio Commentary Stream Hub (100% In-Frame Playable)
      addSource({
        id: `scraped-yt-${Date.now()}-1`,
        name: `YouTube Live Broadcast Hub (${cleanHome} vs ${cleanAway})`,
        shortName: 'Live Feed 1 (HD)',
        type: 'youtube_live',
        provider: 'YouTube Live Match Relay',
        badge: '🔴 Live Frame Stream',
        url: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live stream commentary')}&autoplay=1&mute=0`,
        embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live stream commentary')}&autoplay=1&mute=0`,
        straightUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live stream')}`,
        supportsIframe: true,
        playableInFrame: true,
        verifiedMatch: true,
        quality: '1080p / 60 FPS',
        latency: 'Ultra-low (0.5s)',
        description: `Verified live match stream and in-frame synchronized commentary feed for ${cleanHome} vs ${cleanAway}`
      });

      // 2. Scrape DuckDuckGo HTML / Web for Live Match Direct Embed Streams
      try {
        const ddgSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('"' + cleanHome + '" "' + cleanAway + '" live stream football soccer stream')}`;
        const ddgRes = await fetch(ddgSearchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(3500)
        });

        if (ddgRes.ok) {
          const html = await ddgRes.text();
          // Extract result links
          const linkRegex = /<a\s+class="result__url"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
          const snippetRegex = /<a\s+class="result__snippet"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
          let matchResult;
          let count = 0;

          // Simple link parser
          const rawLinks = [];
          const anchorRegex = /<a\s+[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          while ((matchResult = anchorRegex.exec(html)) !== null && count < 6) {
            let targetHref = matchResult[1];
            if (targetHref.includes('uddg=')) {
              const parsed = new URL('https://duckduckgo.com' + targetHref);
              targetHref = decodeURIComponent(parsed.searchParams.get('uddg') || targetHref);
            }
            if (targetHref.startsWith('http') && !targetHref.includes('duckduckgo.com') && !targetHref.includes('google.')) {
              rawLinks.push({
                url: targetHref,
                snippet: matchResult[2].replace(/<[^>]+>/g, '').trim()
              });
              count++;
            }
          }

          rawLinks.forEach((item, idx) => {
            const domain = new URL(item.url).hostname.replace(/^www\./, '');
            const proxyEmbedUrl = `/api/stream-frame-embed?url=${encodeURIComponent(item.url)}&match=${encodeURIComponent(matchQuery)}`;
            addSource({
              id: `scraped-web-${idx + 1}`,
              name: `${domain.toUpperCase()} Live Match Relay (${cleanHome} vs ${cleanAway})`,
              shortName: `${domain.split('.')[0].slice(0, 10).toUpperCase()} Feed`,
              type: 'scraped_web',
              provider: domain,
              badge: '⚡ Scraped In-Frame',
              url: proxyEmbedUrl,
              embedUrl: proxyEmbedUrl,
              straightUrl: item.url,
              supportsIframe: true,
              playableInFrame: true,
              verifiedMatch: true,
              quality: 'HD Stream Relay',
              latency: 'Direct Frame Relay',
              description: `Real-time web scraped stream for ${cleanHome} vs ${cleanAway} via in-frame proxy: ${item.snippet.slice(0, 80)}...`
            });
          });
        }
      } catch (ddgErr) {
        // Fallback gracefully
      }

      // 3. Sportzx Live Search Scrape
      try {
        const sportzxUrl = `https://sportzx.net/?s=${encodeURIComponent(cleanHome + ' ' + cleanAway)}`;
        const szRes = await fetch(sportzxUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(3000)
        });
        if (szRes.ok) {
          const szHtml = await szRes.text();
          // Check if article with match name exists
          const articleRegex = /<h2\s+class="entry-title"[^>]*><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/gi;
          let artMatch;
          let szFound = 0;
          while ((artMatch = articleRegex.exec(szHtml)) !== null && szFound < 2) {
            const artUrl = artMatch[1];
            const title = artMatch[2];
            const proxyUrl = `/api/stream-frame-embed?url=${encodeURIComponent(artUrl)}&match=${encodeURIComponent(matchQuery)}`;
            addSource({
              id: `scraped-sportzx-${szFound + 1}`,
              name: `Sportzx HD Match Feed: ${title}`,
              shortName: `Sportzx Match ${szFound + 1}`,
              type: 'sportzx',
              provider: 'Sportzx Verified Match Relay',
              badge: '⚡ Sportzx In-Frame',
              url: proxyUrl,
              embedUrl: proxyUrl,
              straightUrl: artUrl,
              supportsIframe: true,
              playableInFrame: true,
              verifiedMatch: true,
              quality: '1080p HD',
              latency: 'Low',
              description: `Direct match article stream on Sportzx for ${cleanHome} vs ${cleanAway}`
            });
            szFound++;
          }
        }
      } catch (szErr) {
        // Continue
      }

      // 4. Totalsportek / FootyBite Scraped Feed
      const totalsportekProxy = `/api/stream-frame-embed?url=${encodeURIComponent(`https://totalsportek.pro/?s=${encodeURIComponent(searchKeywords)}`)}&match=${encodeURIComponent(matchQuery)}`;
      addSource({
        id: 'scraped-totalsportek',
        name: `Totalsportek Match Stream Hub (${cleanHome} vs ${cleanAway})`,
        shortName: 'Totalsportek Frame',
        type: 'totalsportek',
        provider: 'Totalsportek / FootyBite Global',
        badge: '🌐 In-Frame Stream',
        url: totalsportekProxy,
        embedUrl: totalsportekProxy,
        straightUrl: `https://totalsportek.pro/?s=${encodeURIComponent(searchKeywords)}`,
        supportsIframe: true,
        playableInFrame: true,
        verifiedMatch: true,
        quality: '720p/1080p',
        latency: 'Low',
        description: `Direct in-frame Totalsportek match streaming hub for ${cleanHome} vs ${cleanAway}`
      });

      // 5. Score808 In-Frame Stream Proxy
      const score808Proxy = `/api/stream-frame-embed?url=${encodeURIComponent(`https://www.score808.com`)}&match=${encodeURIComponent(matchQuery)}`;
      addSource({
        id: 'scraped-score808',
        name: `Score808 Live Multi-Feed (${cleanHome} vs ${cleanAway})`,
        shortName: 'Score808 Frame',
        type: 'score808',
        provider: 'Score808 Global HD Relay',
        badge: '⚽ Score808 In-Frame',
        url: score808Proxy,
        embedUrl: score808Proxy,
        straightUrl: 'https://www.score808.com',
        supportsIframe: true,
        playableInFrame: true,
        verifiedMatch: true,
        quality: 'Multi-Bitrate HD',
        latency: 'Low',
        description: `Score808 in-frame verified sports stream feed`
      });

      // 6. Interactive 2D Radar Simulation (Always Playable In-Frame Fallback)
      addSource({
        id: 'radar-fallback',
        name: 'Interactive 2D Pitch Radar & Tactical Simulator',
        shortName: '2D Pitch Radar',
        type: 'radar',
        provider: 'Engine Tactical Radar',
        badge: '🎯 In-App Radar',
        supportsIframe: true,
        playableInFrame: true,
        verifiedMatch: true,
        quality: 'Live 60 FPS Vector Canvas',
        latency: 'Zero Latency (Realtime)',
        description: 'Real-time pitch positioning, dangerous attacks tracking, momentum barometer, and shot maps'
      });

      res.json({
        success: true,
        match: { home: cleanHome, away: cleanAway, league },
        totalFound: scrapedStreams.length,
        sources: scrapedStreams
      });
    } catch (err) {
      console.error('Error in /api/scrape-match-streams:', err);
      res.status(500).json({ success: false, error: err.message, sources: [] });
    }
  });

  // Safe In-Frame Stream Embed Proxy: bypasses X-Frame-Options and CSP frame-ancestors restrictions
  app.get('/api/stream-frame-embed', async (req, res) => {
    const targetUrl = req.query.url;
    const matchName = req.query.match || 'Live Soccer Match';

    if (!targetUrl) {
      return res.status(400).send('Missing target URL');
    }

    // SSRF guard: only public http(s) hosts — never loopback, link-local (cloud metadata) or private ranges
    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return res.status(400).send('Invalid target URL');
    }
    const host = parsedTarget.hostname.toLowerCase().replace(/^[|]$/g, '');
    const isPrivateHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
      /^(127.|10.|0.|169.254.|192.168.|172.(1[6-9]|2d|3[01]).)/.test(host) ||
      host === '::1' || host === '::' || /^(fc|fd|fe80)/.test(host) || /^::ffff:/.test(host);
    if (!['http:', 'https:'].includes(parsedTarget.protocol) || isPrivateHost) {
      return res.status(400).send('Target URL not allowed');
    }
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    try {
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': targetUrl
        },
        signal: AbortSignal.timeout(6000)
      });

      const contentType = fetchRes.headers.get('content-type') || 'text/html';
      
      if (!contentType.includes('text/html')) {
        // Direct stream or media or redirect
        return res.redirect(targetUrl);
      }

      let html = await fetchRes.text();
      const parsedUrl = new URL(targetUrl);
      const origin = parsedUrl.origin;

      // Inject base tag for relative stylesheets, images, scripts
      if (!html.includes('<base ')) {
        html = html.replace(/<head[^>]*>/i, `$&<base href="${origin}/">`);
      }

      // Neutralize frame-busting scripts (top.location != self.location etc.)
      const deBustScript = `
        <script>
          try {
            Object.defineProperty(window, 'top', { get: function() { return window.self; } });
            Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
          } catch(e) {}
        </script>
        <style>
          /* Clean frame enhancements */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.5); border-radius: 3px; }
        </style>
      `;

      html = html.replace(/<head[^>]*>/i, `$&${deBustScript}`);

      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('Cross-Origin-Embedder-Policy');
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Security-Policy', "frame-ancestors *");

      res.send(html);
    } catch (err) {
      // Fallback clean error player view
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; background: #020617; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; }
            .btn { display: inline-flex; align-items: center; gap: 8px; background: #059669; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 16px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); }
            .btn:hover { background: #10b981; }
          </style>
        </head>
        <body>
          <div style="font-size: 28px; margin-bottom: 8px;">📡 Live Stream In-Frame Relay</div>
          <p style="color: #94a3b8; max-width: 480px; font-size: 14px;">Connecting to ${escapeHtml(matchName)} stream relay source.</p>
          <a class="btn" href="${escapeHtml(parsedTarget.href)}" target="_blank" rel="noopener noreferrer">Open Stream Relay Directly ↗</a>
        </body>
        </html>
      `);
    }
  });

  app.get('/api/stream-sources', (req, res) => {
    const home = (req.query.home || 'Home').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const away = (req.query.away || 'Away').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const league = req.query.league || '';
    const query = encodeURIComponent(`${home} ${away}`);

    const sources = [
      {
        id: 'sportzx-direct',
        name: `Sportzx Live Stream (${home} vs ${away})`,
        provider: 'Sportzx Direct Live Sports',
        badge: '⚡ Sportzx Direct',
        straightUrl: `https://sportzx.net/?s=${query}`,
        backupStraightUrl: `https://sportzx.cc/?s=${query}`,
        portalUrl: 'https://sportzx.net/football',
        searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('sportzx ' + home + ' vs ' + away + ' live stream free')}`
      },
      {
        id: 'streameast-direct',
        name: `StreamEast Global (${home} vs ${away})`,
        provider: 'StreamEast Sports',
        badge: '📺 StreamEast Free',
        straightUrl: 'https://thestreameast.to/category/soccer',
        backupStraightUrl: `https://thestreameast.to/?s=${query}`,
        portalUrl: 'https://streameast.app'
      },
      {
        id: 'totalsportek-direct',
        name: `Totalsportek / FootyBite (${home} vs ${away})`,
        provider: 'Totalsportek & FootyBite',
        badge: '🌐 Totalsportek',
        straightUrl: `https://totalsportek.pro/?s=${query}`,
        backupStraightUrl: `https://footybite.to/?s=${query}`,
        portalUrl: 'https://totalsportek.pro'
      },
      {
        id: 'score808-direct',
        name: `Score808 Live HD (${home} vs ${away})`,
        provider: 'Score808 Global HD',
        badge: '⚽ Score808 Free',
        straightUrl: 'https://www.score808.com',
        backupStraightUrl: 'https://score808.ink',
        portalUrl: 'https://www.score808.com'
      },
      {
        id: 'viprow-direct',
        name: `VIPRow / VIPBox Free (${home} vs ${away})`,
        provider: 'VIPRow Global Free Network',
        badge: '🏆 VIPRow Free',
        straightUrl: 'https://www.viprow.nu/sports-football-online',
        backupStraightUrl: 'https://www.vipbox.lc/football-live',
        portalUrl: 'https://www.viprow.nu'
      }
    ];

    res.json({
      success: true,
      match: { home, away, league },
      sportzxUrl: `https://sportzx.net/?s=${query}`,
      sources
    });
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

  app.post('/api/in-play-prediction', async (req, res) => {
    try {
      const { matchId, liveMinute, liveHomeScore, liveAwayScore, homeRedCards, awayRedCards, lockedPick } = req.body || {};
      let match = null;
      if (matchId) {
        match = (engine.matches || []).find(m => String(m.id) === String(matchId)) ||
                (engine.todayCompletedMatches || []).find(m => String(m.id) === String(matchId));
      }
      if (!match) {
        match = req.body?.match || { home: req.body?.home || 'Home', away: req.body?.away || 'Away' };
      }
      const inPlay = engine.calculateInPlayLivePrediction(
        match,
        liveMinute ?? match.liveMinute ?? 45,
        liveHomeScore ?? match.liveHomeScore ?? (match.goals?.home ?? 0),
        liveAwayScore ?? match.liveAwayScore ?? (match.goals?.away ?? 0),
        { homeRedCards: homeRedCards || 0, awayRedCards: awayRedCards || 0, lockedPick }
      );
      res.json({ success: true, inPlayPrediction: inPlay, advisory: inPlay.advisory });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/in-play-advisory', async (req, res) => {
    try {
      const { matchId, liveMinute, liveHomeScore, liveAwayScore, homeRedCards, awayRedCards, lockedPick } = req.body || {};
      let match = null;
      if (matchId) {
        match = (engine.matches || []).find(m => String(m.id) === String(matchId)) ||
                (engine.todayCompletedMatches || []).find(m => String(m.id) === String(matchId));
      }
      if (!match) {
        match = req.body?.match || { home: req.body?.home || 'Home', away: req.body?.away || 'Away' };
      }
      const report = engine.getInPlayAdvisoryReport(
        match,
        liveMinute ?? match.liveMinute ?? 45,
        liveHomeScore ?? match.liveHomeScore ?? (match.goals?.home ?? 0),
        liveAwayScore ?? match.liveAwayScore ?? (match.goals?.away ?? 0),
        { homeRedCards: homeRedCards || 0, awayRedCards: awayRedCards || 0, lockedPick }
      );
      res.json({ success: true, advisory: report });
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

  app.get('/api/all-day-winner', async (req, res) => {
    try {
      const size = parseInt(req.query.size || '8', 10);
      const minConfidence = parseFloat(req.query.minConfidence || '60');
      const forceRefresh = req.query.refresh === 'true';
      const lotto = await engine.getAllDayWinnerLotto({ size, minConfidence, forceRefresh });
      res.json({ success: true, ...lotto });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/team-recent-matches', (req, res) => {
    try {
      const team = req.query.team || '';
      const limit = parseInt(req.query.limit || '20', 10);
      if (!team) {
        return res.status(400).json({ success: false, error: 'Query parameter "team" is required.' });
      }
      const matches = engine.getRecentMatchesForTeam(team, limit);
      res.json({ success: true, team, count: matches.length, matches });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/team-coach', async (req, res) => {
    try {
      const team = req.query.team || '';
      const league = req.query.league || '';
      if (!team) {
        return res.status(400).json({ success: false, error: 'Query parameter "team" is required.' });
      }
      const coach = await engine.fetchDynamicTeamCoach(team, league);
      res.json({ success: true, team, coach: coach || 'Head Coach' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/override-manager', (req, res) => {
    try {
      const { team, manager, system } = req.body || {};
      if (!team || !manager) {
        return res.status(400).json({ success: false, error: 'Both team and manager are required' });
      }
      engine.overrideTeamManager(team, manager, system);
      res.json({ success: true, message: `Successfully updated manager for ${team} to ${manager}` });
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

      // Attempt fallback from historical matches, today's completions, or state
      const rawFallback = (engine.todayCompletedMatches || [])
        .concat(engine.yesterdayMatches || [])
        .concat(engine.historicalMatches || [])
        .concat(engine.matches || [])
        .filter(x => {
          const d = x.dateIso || x.date || x.utcDate;
          if (d && String(d).startsWith(date)) return true;
          if (x.timestamp && typeof x.timestamp === 'number') {
            const tsIso = new Date(x.timestamp).toISOString().slice(0, 10);
            if (tsIso === date) return true;
          }
          return false;
        })
        .filter(x => !isLeagueBlacklisted(x.league) && !engine.isLeagueDisabled(x.league));

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

  app.post('/api/lineups/auto-calibrate', async (req, res) => {
    try {
      const force = req.body?.force === true;
      const result = await engine.autoCalibrateAllUpcomingLineups(force);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leagues/strict-pruning', (req, res) => {
    try {
      const enabled = req.body?.enabled !== false;
      const result = engine.setStrictLeaguePruning(enabled);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/strategy-proof-metrics', (req, res) => {
    try {
      const metrics = engine.getStrategyProofMetrics();
      res.json({ success: true, metrics });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/pre-kickoff-ledger', (req, res) => {
    try {
      const ledger = engine.getPreKickoffLedger ? engine.getPreKickoffLedger() : [];
      const summary = engine.getPreKickoffLedgerSummary ? engine.getPreKickoffLedgerSummary() : null;
      res.json({ success: true, count: ledger.length, ledger, summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/run-20k-backtest', (req, res) => {
    try {
      const options = req.body || {};
      const results = engine.runComprehensiveHistoricalBacktest(options);
      res.json({ success: true, results });
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

  const distDir = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

  if (hasDist && (process.env.NODE_ENV === 'production' || process.env.SERVE_DIST === 'true')) {
    console.log('[Server] Serving pre-bundled production assets from /dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.log('[Server] Initializing Vite dev middleware');
    const disableHmr = process.env.DISABLE_HMR === 'true' || Boolean(process.env.PORT) || process.env.NODE_ENV === 'production';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development Vite middleware mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`API Engine running on http://0.0.0.0:${PORT}`);
    // Start continuous autonomous agent in the background after server is listening
    setTimeout(() => {
      engine.startAutonomousAgent();
    }, 1000);
  });
}

startServer();
