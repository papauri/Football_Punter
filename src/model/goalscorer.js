// Anytime goalscorer: the chance each player scores at least once.
//
// A player's expected goals = his team's expected goals (from the bookmaker's prices) × his share of
// the team's non-penalty goals while on the pitch (shrunk towards his position's share) × the part
// of the match he is expected to play, plus his share of the team's penalties (from who took its
// recent ones). P(scores) = 1 − exp(−expected goals). Before lineups, each player of the team's last
// six squads counts in proportion to how often he started.
//
// Fitted on the big five leagues 2023-24 and 2024-25, tested on later seasons (lineup known),
// nothing from which was used to fit. Big five, 2025-26 and 2026-27: 40-50% scored 45.7% (269),
// 50-60% 53.0% (83), 60%+ 66.7% (27); log loss 0.191 against 0.217 for goals-per-game. With the same
// parameters, 14 more leagues (Netherlands, Portugal, Turkey, Belgium, Scotland, Greece, English
// Championship, German and Spanish second tiers, MLS, Brazil, Argentina, Japan, Mexico), 2025 or
// 2025-26 onward: 40-50% 45.0% (825), 50-60% 63.0% (154), 60%+ 68.2% (22). Before lineups the
// figures hold too. Only a handful of players a season reach 60%, so a "very likely" scorer is rare.

export const PARAMS = {
  tau: 292, a: 29.6,
  s0: { GK: 0.0005, DEF: 0.0402, MID: 0.081, ATT: 0.163, FWD: 0.27, UNK: 0.075 },
  pi: 0.085, omega: 0.03, bPen: 0.3, tauPen: 540, rho: 0.7, preN: 6,
  startPrior: 0.45, subOnPrior: 0.594, subFracPrior: 0.275
};

// Test-season record by chance band (lineup known), for display.
export const SCORER_RECORD = [
  { from: 60, picks: 51, scored: 72.5 },
  { from: 50, picks: 239, scored: 58.2 },
  { from: 40, picks: 1094, scored: 45.6 },
  { from: 30, picks: 4929, scored: 35.1 }
];

const GROUP = (pos) => {
  if (!pos || pos === 'SUB') return null;
  if (pos === 'G') return 'GK';
  if (/^(CD|LB|RB|SW)/.test(pos)) return 'DEF';
  if (/^(CM|DM|M$|RCM|LM|RM)/.test(pos)) return 'MID';
  if (/^(AM|LF|RF)/.test(pos)) return 'ATT';
  return 'FWD';
};
const dec = (st, now, tau) => (st ? st.v * Math.exp(-(now - st.t) / tau) : 0);
const add = (st, now, tau, x) => ({ v: dec(st, now, tau) + x, t: now });

export class GoalscorerModel {
  constructor(state = null) {
    this.players = new Map(Object.entries(state?.players || {}));
    this.teams = new Map(Object.entries(state?.teams || {}));
    this.seen = new Set(state?.seen || []);
    this.lastMatch = state?.lastMatch || null;
  }

  // Players and teams with nothing in the last 400 days are dropped (transfers out, retirements).
  toJSON() {
    const cutoff = (Date.parse(this.lastMatch || 0) || Date.now()) / 864e5 - 400;
    const active = (ps) => [ps.sN, ps.bN, ps.expo].some(x => x && x.t >= cutoff);
    const players = Object.fromEntries([...this.players].filter(([, ps]) => active(ps)));
    const teams = Object.fromEntries([...this.teams].filter(([, tm]) => tm.recent.length && Object.keys(tm.recent.at(-1)).some(id => players[id])));
    // Numbers to five significant figures keep the file small without changing a chance.
    const round = (x) => (typeof x === 'number' ? +x.toPrecision(5) : Array.isArray(x) ? x.map(round)
      : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)])) : x);
    return { players: round(players), teams: round(teams), seen: [...this.seen].slice(-12000), lastMatch: this.lastMatch };
  }

  /**
   * Learn from a finished match. `event` = { id, date, teams: [{ id, lam (expected goals from
   * prices, or null), players: [{ id, n, pos, st, on, off, npg, pg }], pens: [{ p }] }] }, with
   * on/off the minutes a player was on the pitch (null when unused).
   */
  update(event) {
    if (this.seen.has(String(event.id))) return;
    this.seen.add(String(event.id));
    const P = PARAMS, now = Date.parse(event.date) / 864e5, lamNP = 1 - P.pi - P.omega;
    for (const t of event.teams) {
      const tl = (t.lam || 1.39) * lamNP;
      const tm = this.teams.get(String(t.id)) || { recent: [], pens: [] };
      const rec = {};
      for (const p of t.players) {
        const ps = this.players.get(String(p.id)) || { n: p.n };
        ps.n = p.n;
        rec[p.id] = p.st ? 'S' : 'B';
        const g = GROUP(p.pos);
        if (p.st && g) { ps.pos ||= {}; for (const k in ps.pos) ps.pos[k] *= 0.97; ps.pos[g] = (ps.pos[g] || 0) + 1; }
        const frac = p.on != null ? (p.off - p.on) / 90 : 0;
        if (p.st) { ps.sFrac = add(ps.sFrac, now, P.tau, frac); ps.sN = add(ps.sN, now, P.tau, 1); }
        else { ps.bN = add(ps.bN, now, P.tau, 1); if (p.on != null) { ps.bOn = add(ps.bOn, now, P.tau, 1); ps.subFrac = add(ps.subFrac, now, P.tau, frac); } else ps.bOn = add(ps.bOn, now, P.tau, 0); }
        if (p.on != null) { ps.expo = add(ps.expo, now, P.tau, tl * frac); ps.npg = add(ps.npg, now, P.tau, p.npg); }
        this.players.set(String(p.id), ps);
      }
      tm.recent.push(rec);
      if (tm.recent.length > 20) tm.recent.shift();
      for (const x of t.pens || []) if (x.p) tm.pens.push({ p: String(x.p), t: now });
      tm.pens = tm.pens.filter(x => now - x.t < 4 * P.tauPen);
      this.teams.set(String(t.id), tm);
    }
    if (!this.lastMatch || event.date > this.lastMatch) this.lastMatch = event.date;
  }

  /**
   * Chances for one team. `lam` = its expected goals from the prices. `squad` = confirmed matchday
   * squad [{ id, n, starter }] or null for before lineups (the team's recent squads are used).
   * Returns [{ id, name, chance (0-1), starter }] sorted by chance.
   */
  predict(teamId, lam, squad = null, at = Date.now()) {
    const P = PARAMS, now = at / 864e5, lamNP = 1 - P.pi - P.omega;
    const S = (id) => this.players.get(String(id)) || {};
    const group = (ps) => { const c = ps.pos || {}; let g = null, b = 0; for (const k in c) if (c[k] > b) { b = c[k]; g = k; } return g || 'UNK'; };
    const share = (ps) => (dec(ps.npg, now, P.tau) + P.a * P.s0[group(ps)]) / (dec(ps.expo, now, P.tau) + P.a);
    const mStart = (ps) => (dec(ps.sFrac, now, P.tau) + 3 * P.startPrior) / (dec(ps.sN, now, P.tau) + 3);
    const mSub = (ps) => ((dec(ps.bOn, now, P.tau) + 2 * P.subOnPrior) / (dec(ps.bN, now, P.tau) + 2)) * ((dec(ps.subFrac, now, P.tau) + 2 * P.subFracPrior) / (dec(ps.bOn, now, P.tau) + 2));
    const tm = this.teams.get(String(teamId)) || { recent: [], pens: [] };
    const penW = (id) => tm.pens.reduce((s, x) => s + (x.p === String(id) ? Math.exp(-(now - x.t) / P.tauPen) : 0), 0);

    let cands;
    if (squad?.length) {
      cands = squad.map(p => ({ id: String(p.id), name: p.n || S(p.id).n, starter: !!p.starter, m: p.starter ? mStart(S(p.id)) : mSub(S(p.id)) }));
    } else {
      const recent = tm.recent.slice(-P.preN).reverse();
      if (recent.length < 3) return [];
      const ids = new Set(recent.flatMap(r => Object.keys(r)));
      cands = [...ids].map(id => {
        let ws = 0, wsS = 0, wsB = 0;
        recent.forEach((r, k) => { const w = P.rho ** k; ws += w; if (r[id] === 'S') wsS += w; else if (r[id]) wsB += w; });
        return { id, name: S(id).n, starter: null, m: (wsS / ws) * mStart(S(id)) + (wsB / ws) * mSub(S(id)) };
      });
    }
    const info = cands.map(c => ({ ...c, s: share(S(c.id)), w: penW(c.id) }));
    const sumSM = info.reduce((s, x) => s + x.s * x.m, 0) || 1;
    const sumS = info.reduce((s, x) => s + x.s, 0) || 1;
    const penDen = info.reduce((s, x) => s + (x.w + P.bPen * x.s / sumS) * x.m, 0) || 1;
    return info.map(x => {
      const mu = lam * lamNP * x.s * x.m / sumSM + lam * P.pi * (x.w + P.bPen * x.s / sumS) * x.m / penDen;
      return { id: x.id, name: x.name, starter: x.starter, chance: 1 - Math.exp(-mu) };
    }).sort((a, b) => b.chance - a.chance);
  }
}

/** A finished ESPN match summary in the shape update() takes (lam filled in by the caller). */
export function eventFromSummary(summary, eventId) {
  const comp = summary?.header?.competitions?.[0];
  if (!comp || !summary.rosters?.length) return null;
  const minute = (c) => Math.round((c?.value ?? 0) / 60);
  // Goals, substitutions and red cards from the key events (the header's details list is often
  // incomplete). A scoring play's type says whether it was a penalty or an own goal.
  const ke = summary.keyEvents || [];
  const goals = ke.filter(k => k.scoringPlay && !k.shootout).map(k => {
    const type = String(k.type?.type || '');
    return { team: String(k.team?.id), p: k.participants?.[0]?.athlete?.id, pen: type.includes('penalty'), og: type.includes('own') };
  });
  const subs = ke.filter(k => k.type?.type === 'substitution').map(k => ({ min: minute(k.clock), in: k.participants?.[0]?.athlete?.id, out: k.participants?.[1]?.athlete?.id }));
  const reds = ke.filter(k => k.type?.type === 'red-card').map(k => ({ min: minute(k.clock), p: k.participants?.[0]?.athlete?.id }));
  const penMiss = ke.filter(k => /^penalty---/.test(k.type?.type || '') && k.type.type !== 'penalty---scored' && !k.shootout).map(k => ({ team: String(k.team?.id), p: k.participants?.[0]?.athlete?.id }));
  const teams = summary.rosters.map(r => {
    const tid = String(r.team?.id);
    const players = (r.roster || []).map(p => {
      const id = p.athlete?.id;
      let on = null, off = null;
      const sin = subs.find(s => s.in === id), sout = subs.find(s => s.out === id), red = reds.find(x => x.p === id);
      if (p.starter) { on = 0; off = 90; }
      if (!p.starter && (p.subbedIn || sin)) { on = sin ? sin.min : 60; off = 90; }
      if (on != null && sout) off = Math.max(on, sout.min);
      if (on != null && red) off = Math.min(off, Math.max(on, red.min));
      const own = goals.filter(g => g.p === id && !g.og);
      return { id, n: p.athlete?.displayName, pos: p.position?.abbreviation, st: !!p.starter, on, off, npg: own.filter(g => !g.pen).length, pg: own.filter(g => g.pen).length };
    });
    const pens = [...goals.filter(g => g.team === tid && g.pen), ...penMiss.filter(x => x.team === tid)].map(x => ({ p: x.p }));
    return { id: tid, lam: null, players, pens };
  });
  return { id: String(eventId), date: summary.header?.competitions?.[0]?.date || comp.date, teams };
}
