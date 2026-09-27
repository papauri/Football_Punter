// Matching team names between sources (ESPN, football-data.co.uk, understat) that spell them
// differently: "Man United" and "Manchester United", "Nott'm Forest" and "Nottingham Forest".

const STOP = new Set(['fc', 'cf', 'ac', 'sc', 'afc', 'cd', 'ud', 'sd', 'rc', 'club', 'de', 'the', 'fk', 'sk', 'if', 'bk', 'as', 'ss', 'us', 'vfl', 'vfb', 'tsg', 'sv', 'fsv', '1', 'calcio', 'football', 'town', 'city', 'united', 'utd']);
const ALIASES = {
  'man united': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
  "nott'm forest": 'nottingham forest', 'spurs': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
  'sheffield weds': 'sheffield wednesday', 'ath madrid': 'atletico madrid', 'ath bilbao': 'athletic club',
  'betis': 'real betis', 'sociedad': 'real sociedad', 'inter': 'internazionale', 'milan': 'ac milan',
  'paris sg': 'paris saint germain', "m'gladbach": 'borussia monchengladbach', 'ein frankfurt': 'eintracht frankfurt',
  'fc koln': 'koln', 'st pauli': 'st pauli', 'leverkusen': 'bayer leverkusen', 'dortmund': 'borussia dortmund',
  'sp lisbon': 'sporting cp', 'sp braga': 'braga', 'vitoria': 'vitoria guimaraes', 'psv eindhoven': 'psv',
  'espanol': 'espanyol', 'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'la coruna': 'deportivo la coruna'
};

export function normalizeTeam(name) {
  let s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (ALIASES[s]) s = ALIASES[s];
  return s.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t)).join(' ');
}

function bigrams(s) {
  const out = new Map();
  const t = s.replace(/\s+/g, '');
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1);
  return out;
}

export function similarity(a, b) {
  const x = normalizeTeam(a), y = normalizeTeam(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const bx = bigrams(x), by = bigrams(y);
  let overlap = 0, total = 0;
  for (const [k, v] of bx) { overlap += Math.min(v, by.get(k) || 0); total += v; }
  for (const v of by.values()) total += v;
  return total ? (2 * overlap) / total : 0;
}

// The full name with aliases applied, keeping words like "City" and "United" that normalizeTeam
// drops. Used to tell Manchester City from Manchester United when both reduce to "manchester".
function fullName(name) {
  let s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (ALIASES[s]) s = ALIASES[s];
  return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function dice(x, y) {
  const bx = bigrams(x), by = bigrams(y);
  let overlap = 0, total = 0;
  for (const [k, v] of bx) { overlap += Math.min(v, by.get(k) || 0); total += v; }
  for (const v of by.values()) total += v;
  return total ? (2 * overlap) / total : 0;
}

/** The candidate that best matches a team name, or null when none is close enough. */
export function bestTeamMatch(name, candidates, min = 0.85) {
  const full = fullName(name);
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = similarity(name, c);
    if (s < min) continue;
    const score = s + 0.5 * dice(full, fullName(c));
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}
