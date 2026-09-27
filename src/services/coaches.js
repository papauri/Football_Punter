// Current head coach for a club or national team, from Wikidata.
//
// Managers used to be hard-coded in engine.js (and several were already out of date), with the
// ESPN team roster as a "live" source. The ESPN roster's coach list is historical, not current
// (Real Madrid's starts with managers from years ago), and the code read a field ESPN does not
// send, so the live lookup never succeeded and the hard-coded names were always shown.
//
// Wikidata records each club's head coach (property P286) with start and end dates, and is edited
// within days of a change. We take the coach with no end date and the latest start date.
// Results are cached on disk for a week (a day when nothing was found), so each team costs at
// most one query a week.

import fs from 'fs';
import path from 'path';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'FootballPunter/1.0 (football prediction app)';
const FOUND_TTL = 7 * 24 * 60 * 60 * 1000;
const MISSING_TTL = 24 * 60 * 60 * 1000;
// association football club, national team, men's national team, women's national team, youth team
const TEAM_TYPES = ['Q476028', 'Q6979593', 'Q135408445', 'Q1478437', 'Q103229495'];

let cache = null;
let cacheFile = null;
let queue = Promise.resolve();

function load(dir) {
  if (cache) return cache;
  cacheFile = path.join(dir, 'data', 'coach-cache.json');
  try { cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {}; } catch { cache = {}; }
  return cache;
}

function save() {
  try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch { /* cache is best effort */ }
}

const keyOf = (team) => String(team || '').trim().toLowerCase();

function nameVariants(team) {
  const t = String(team).replace(/["\\]/g, '').trim();
  return [...new Set([
    t, `${t} CF`, `${t} FC`, `${t} F.C.`, `FC ${t}`, `${t} SC`, `AC ${t}`,
    `${t} national football team`, `${t} men's national football team`,
    `${t} national association football team`, `${t} men's national association football team`
  ])];
}

async function queryWikidata(team) {
  const values = nameVariants(team).map(v => `"${v}"@en`).join(' ');
  const types = TEAM_TYPES.map(t => `wd:${t}`).join(' ');
  const q = `SELECT ?coachLabel ?start WHERE {
    VALUES ?name { ${values} }
    ?club rdfs:label|skos:altLabel ?name .
    VALUES ?type { ${types} }
    ?club wdt:P31 ?type .
    ?club p:P286 ?st . ?st ps:P286 ?coach .
    OPTIONAL { ?st pq:P580 ?start }
    FILTER NOT EXISTS { ?st pq:P582 ?end }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 20`;
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(q)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(20000) : undefined
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const rows = (await res.json()).results.bindings
    .map(b => ({ coach: b.coachLabel?.value, start: b.start?.value || '' }))
    .filter(r => r.coach && !/^Q\d+$/.test(r.coach));
  rows.sort((a, b) => b.start.localeCompare(a.start));
  return rows[0] ? { coach: rows[0].coach, since: rows[0].start.slice(0, 10) || null } : null;
}

/** Cached coach, without any network call. */
export function peekCoach(team, dir) {
  const hit = load(dir)[keyOf(team)];
  return hit && hit.coach ? hit.coach : null;
}

/**
 * Current head coach for a team, or null when Wikidata has none. Queries are made one at a time
 * so a page of fixtures does not burst the public endpoint.
 */
export function getCurrentCoach(team, dir) {
  const key = keyOf(team);
  if (!key) return Promise.resolve(null);
  const c = load(dir);
  const hit = c[key];
  if (hit && Date.now() - hit.at < (hit.coach ? FOUND_TTL : MISSING_TTL)) return Promise.resolve(hit.coach || null);
  const job = queue.then(async () => {
    try {
      let found;
      try { found = await queryWikidata(team); } catch { await new Promise(r => setTimeout(r, 1500)); found = await queryWikidata(team); }
      c[key] = { coach: found?.coach || null, since: found?.since || null, at: Date.now() };
      save();
      return c[key].coach;
    } catch {
      return hit?.coach || null; // keep a stale name rather than lose it on a network error
    } finally {
      await new Promise(r => setTimeout(r, 300));
    }
  });
  queue = job.catch(() => null);
  return job;
}
