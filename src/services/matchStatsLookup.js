// Live access to the corners and cards model: finds a fixture's two teams among the teams the
// model knows (spelled the football-data.co.uk way) and returns what it expects.
import fs from 'fs';
import path from 'path';
import { MatchStatsModel, statPicks } from '../model/matchStats.js';
import { bestTeamMatch } from '../model/teamNames.js';

let loaded = null;
let loadedAt = 0;

// data/match-stats.json ships with the app; the server refreshes data/match-stats.live.json daily
// with the latest results. Whichever holds the later ratings is used (the later fit on a tie).
function newest(dir) {
  const files = ['match-stats.live.json', 'match-stats.json'].map(f => path.join(dir, 'data', f)).filter(f => fs.existsSync(f));
  let best = null, bestKey = '';
  for (const f of files) {
    try {
      const text = fs.readFileSync(f, 'utf8');
      // Latest ratings first; on a tie, the more recent fit (it may carry a newer model).
      const key = `${(text.match(/"lastMatch":"([\d-]+)"/) || [])[1] || ''}|${(text.match(/"fittedAt":"([^"]+)"/) || [])[1] || ''}`;
      if (key > bestKey) { best = f; bestKey = key; }
    } catch { /* skip unreadable */ }
  }
  return best;
}

function load(dir) {
  const file = newest(dir);
  if (!file) return null;
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (!loaded || mtime !== loadedAt || loaded.file !== file) {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      loaded = { file, json, model: MatchStatsModel.fromJSON(json), names: Object.keys(json.teams || {}) };
      loadedAt = mtime;
    }
  } catch { loaded = null; }
  return loaded;
}

/** Track record and dates for the corners and cards model, or null when no data file is present. */
export function matchStatsSummary(dir) {
  const d = load(dir);
  return d ? { lastMatch: d.json.lastMatch, heldOut: d.json.heldOut, recent: d.json.recent || [] } : null;
}

/**
 * Expected corners and cards for a fixture, or null when either team is not in the 14 leagues
 * the model covers, or the two play in different leagues (cup and European ties). `goals` is the
 * market's expected goals for the match ({lambda, mu}), which sharpens each line when given.
 */
export function predictMatchStats(dir, home, away, goals = null) {
  const d = load(dir);
  if (!d) return null;
  const h = bestTeamMatch(home, d.names), a = bestTeamMatch(away, d.names);
  if (!h || !a || h === a) return null;
  const lg = d.json.teams[h].lg;
  if (!lg || lg !== d.json.teams[a].lg) return null;
  const exp = d.model.expect(lg, h, a);
  if (!exp) return null;
  return { ...exp, league: d.json.leagueNames?.[lg] || lg, homeName: h, awayName: a, picks: statPicks(exp, d.model.p, goals, d.json.marketCalibration) };
}
