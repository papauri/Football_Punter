const fs = require('fs');

let code = fs.readFileSync('engine.js', 'utf8');

// 1. Add autoFetchUpcomingLineups method
if (!code.includes('autoFetchUpcomingLineups() {')) {
  const methodCode = `
  autoFetchUpcomingLineups() {
    const nowMs = Date.now();
    const soonMatches = this.matches.filter(m => {
      if (!m.timestamp) return false;
      const diffMs = m.timestamp - nowMs;
      // within 90 mins of kickoff, or live but not lineup adjusted yet
      return diffMs > -120 * 60 * 1000 && diffMs < 90 * 60 * 1000 && !m.lineupAdjusted;
    });

    soonMatches.forEach(sm => {
      if (!sm.lastLineupAttempt || nowMs - sm.lastLineupAttempt > 5 * 60 * 1000) {
        sm.lastLineupAttempt = nowMs;
        this.fetchMatchLineup(sm.id, null, true).catch(err => {
          this.log('LineupEngine_Error', \`Auto lineup fetch failed for \${sm.home}: \${err.message}\`);
        });
      }
    });
  }
`;
  
  // insert before scrapeSecondaryLiveFeeds
  code = code.replace(/  async scrapeSecondaryLiveFeeds\(\) {/, methodCode + '\n  async scrapeSecondaryLiveFeeds() {');
}

// 2. Call autoFetchUpcomingLineups in scrapeESPNData
if (!code.includes('this.autoFetchUpcomingLineups();')) {
  code = code.replace(/this\.log\('ESPNScraper', \`Successfully synced \$\{newUpcoming\.length\} live\/upcoming fixtures.*\n/, `$&      this.autoFetchUpcomingLineups();\n`);
}

// 3. Inject Gemini AI call into fetchMatchLineup
const targetHook = `const newProbs = this.computeDixonColesProbabilities(effectiveMatch.home, effectiveMatch.away, options);`;
if (code.includes(targetHook) && !code.includes('Running Deep AI evaluation on confirmed lineups')) {
  const aiInjection = `
        const newProbs = this.computeDixonColesProbabilities(effectiveMatch.home, effectiveMatch.away, options);

        if (isOfficial && getGemini()) {
          try {
            this.log('LineupEngine_AI', \`Running Deep AI evaluation on confirmed lineups for \${effectiveMatch.home} vs \${effectiveMatch.away}...\`);
            const prompt = \`You are a world-class soccer tactical analyst AI.
Evaluate the confirmed starting XIs for:
Home: \${effectiveMatch.home} (\${formattedHome.formation})
Away: \${effectiveMatch.away} (\${formattedAway.formation})

Home Starters: \${formattedHome.starters.map(s => s.name).join(', ')}
Away Starters: \${formattedAway.starters.map(s => s.name).join(', ')}

The current mathematical model predicts:
Home: \${newProbs.home.toFixed(1)}%, Draw: \${newProbs.draw.toFixed(1)}%, Away: \${newProbs.away.toFixed(1)}%

Based on these actual starters (e.g. are key players missing? is there a tactical mismatch?), return ONLY a JSON object with adjusted probabilities (must sum to 100).
Output format: {"home": 45.5, "draw": 25.5, "away": 29.0, "reason": "Home team rests key striker, away team playing strong midfield block."}\`;

            const aiText = await callGemini(prompt, "You are an elite tactical sports AI.");
            if (aiText) {
              let cleaned = aiText.trim();
              if (cleaned.startsWith('\`\`\`')) {
                cleaned = cleaned.replace(/^\`\`\`(json)?/, '').replace(/\`\`\`$/, '').trim();
              }
              const aiResp = JSON.parse(cleaned);
              
              if (aiResp && aiResp.home && aiResp.away && aiResp.draw) {
                newProbs.home = parseFloat(aiResp.home);
                newProbs.away = parseFloat(aiResp.away);
                newProbs.draw = parseFloat(aiResp.draw);
                
                const maxProb = Math.max(newProbs.home, newProbs.away, newProbs.draw);
                newProbs.confidence = maxProb > 50 ? maxProb + 15 : maxProb + 25;
                
                if (newProbs.home > newProbs.away && newProbs.home > newProbs.draw) newProbs.predictedWinner = 'HOME';
                else if (newProbs.away > newProbs.home && newProbs.away > newProbs.draw) newProbs.predictedWinner = 'AWAY';
                else newProbs.predictedWinner = 'DRAW';

                lineupImpact.summary = \`[AI Adjusted] \${aiResp.reason}\`;
              }
            }
          } catch (aiErr) {
            this.log('LineupEngine_AI_Error', \`Failed AI lineup recalibration: \${aiErr.message}\`);
          }
        }
`;
  code = code.replace(targetHook, aiInjection);
}

fs.writeFileSync('engine.js', code);
console.log('patched successfully');
