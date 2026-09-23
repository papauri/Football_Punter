import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lightweight plugin to serve API routes if Vite dev server is run directly
function apiServerPlugin() {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        try {
          const { engine } = await import('./engine.js');

          if (url === '/api/health') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
          }

          if (url === '/api/state') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify(engine.getState()));
          }

          if (url === '/api/historical-30d') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const allMatches = (engine.todayCompletedMatches || [])
              .concat(engine.yesterdayMatches || [])
              .concat(engine.historicalMatches || []);
            const seen = new Set();
            const filtered = [];
            for (const m of allMatches) {
              const id = m.id || `${m.home}-${m.away}`;
              if (seen.has(id)) continue;
              const d = m.dateIso || m.date || m.utcDate;
              if (!d) continue;
              const matchDate = new Date(d);
              if (!isNaN(matchDate.getTime()) && matchDate >= thirtyDaysAgo) {
                seen.add(id);
                filtered.push(m);
              }
            }
            return res.end(JSON.stringify({ matches: filtered }));
          }

          if (url === '/api/strategy-proof-metrics') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify(engine.getStrategyProofMetrics ? engine.getStrategyProofMetrics() : {}));
          }

          if (url === '/api/ai-config') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify(engine.getAiConfigPublic ? engine.getAiConfigPublic() : {}));
          }

          if (url === '/api/scrape') {
            engine.isFetching = false;
            engine.scrapeESPNData().catch(() => {});
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify({
              success: true,
              matchCount: engine.matches?.length || 0,
              message: 'Sync started'
            }));
          }

          if (url === '/api/clear-logs') {
            engine.clearLogs();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true }));
          }

          next();
        } catch (err) {
          console.error('[Vite API Middleware Error]:', err);
          next();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiServerPlugin()],
  server: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    allowedHosts: true,
    hmr: (process.env.DISABLE_HMR === 'true' || process.env.PORT || process.env.NODE_ENV === 'production') ? false : undefined
  }
})
