// Backfills historical 1X2 closing odds from football-data.co.uk onto training_data.json fixtures.
// Usage: node scripts/ingest-historical-odds.mjs   → writes data/historical_odds.json
//
// Matching: same league, kickoff date within ±1 day, identical final score, and fuzzy team-name
// similarity. The exact-score requirement makes false matches between fixtures very unlikely.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { similarity } from '../src/model/teamNames.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'data', 'odds_cache');
const OUT_FILE = path.join(ROOT, 'data', 'historical_odds.json');
const BASE = 'https://www.football-data.co.uk';

// football-data division code → training_data league names
const MAIN_LEAGUES = {
  E0: ['Premier League'], E1: ['Championship'], SC0: ['Scottish Premiership'],
  SP1: ['LaLiga'], SP2: ['LaLiga 2'], I1: ['Serie A'], D1: ['Bundesliga'], D2: ['2. Bundesliga'],
  F1: ['Ligue 1'], N1: ['Eredivisie'], P1: ['Primeira Liga'], B1: ['Belgian Pro League'],
  T1: ['Turkish Super Lig'], G1: ['Greek Super League']
};
// Single-file "extra" leagues (all seasons in one CSV)
const EXTRA_LEAGUES = {
  USA: ['MLS'], MEX: ['Liga MX'], BRA: ['Brasileirão'], JPN: ['Japanese J1 League'],
  SWE: ['Swedish Allsvenskan'], NOR: ['Norwegian Eliteserien'], DNK: ['Danish Superliga'],
  AUT: ['Austrian Bundesliga'], IRL: ['Irish Premier Division']
};
const SEASONS = ['2021', '2122', '2223', '2324', '2425', '2526', '2627'];

function parseDate(d) {
  const [dd, mm, yy] = String(d).split('/').map(Number);
  if (!dd || !mm || !yy) return null;
  return Date.UTC(yy < 100 ? 2000 + yy : yy, mm - 1, dd);
}

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map(l => {
    const cells = l.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x > 1.0 ? x : null; };

const triple = (row, h, d, a, src) => (num(row[h]) && num(row[d]) && num(row[a]))
  ? { h: num(row[h]), d: num(row[d]), a: num(row[a]), src }
  : null;

const firstOf = (row, sets) => {
  for (const [h, d, a, src] of sets) {
    const t = triple(row, h, d, a, src);
    if (t) return t;
  }
  return null;
};

// Closing market average, falling back to Pinnacle then Bet365 closing.
const closingAvg = (row) => firstOf(row, [
  ['AvgCH', 'AvgCD', 'AvgCA', 'AvgC'], ['PSCH', 'PSCD', 'PSCA', 'PSC'], ['B365CH', 'B365CD', 'B365CA', 'B365C']
]);

// Pre-match ("opening") market average. football-data publishes the Avg* columns as the prices
// available when the market opened, against the AvgC* closing columns. Keeping both is what makes a
// point-in-time evaluation possible: a backtest that bets at closing prices is using information
// from after the decision it claims to be testing, and it also flatters the model, because closing
// prices are the sharpest of the week.
const openingAvg = (row) => firstOf(row, [
  ['AvgH', 'AvgD', 'AvgA', 'Avg'], ['B365H', 'B365D', 'B365A', 'B365'], ['BWH', 'BWD', 'BWA', 'BW']
]);

// The individual books football-data surveys, at open and close. Keeping them separately is what
// makes two things possible that an average cannot support:
//   * a SHARP REFERENCE. Pinnacle (PS) is the standard benchmark for a fair price, because it runs on
//     low margin and high limits and moves on money rather than on sentiment. Its de-vigged closing
//     line is the closest thing to a true probability that is publicly available, and it is a far
//     better yardstick than an average that includes soft books.
//   * a SAME-PROVIDER comparison. Measuring closing-line value across different books measures the
//     difference between those books, not the movement of the line.
// BF is the Betfair exchange, whose prices are gross of commission — treated as a book here, but its
// effective price is a few percent lower once commission is paid.
const BOOKS = {
  B365: ['B365H', 'B365D', 'B365A', 'B365CH', 'B365CD', 'B365CA'],
  BW: ['BWH', 'BWD', 'BWA', 'BWCH', 'BWCD', 'BWCA'],
  BF: ['BFH', 'BFD', 'BFA', 'BFCH', 'BFCD', 'BFCA'],
  PS: ['PSH', 'PSD', 'PSA', 'PSCH', 'PSCD', 'PSCA'],
  WH: ['WHH', 'WHD', 'WHA', 'WHCH', 'WHCD', 'WHCA'],
  X1XB: ['1XBH', '1XBD', '1XBA', '1XBCH', '1XBCD', '1XBCA'],
  VC: ['VCH', 'VCD', 'VCA', 'VCCH', 'VCCD', 'VCCA'],
  IW: ['IWH', 'IWD', 'IWA', 'IWCH', 'IWCD', 'IWCA']
};

function perBook(row) {
  const out = {};
  for (const [name, [oh, od, oa, ch, cd, ca]] of Object.entries(BOOKS)) {
    const o = (num(row[oh]) && num(row[od]) && num(row[oa])) ? [num(row[oh]), num(row[od]), num(row[oa])] : null;
    const c = (num(row[ch]) && num(row[cd]) && num(row[ca])) ? [num(row[ch]), num(row[cd]), num(row[ca])] : null;
    if (o || c) out[name] = { ...(o ? { o } : {}), ...(c ? { c } : {}) };
  }
  return Object.keys(out).length ? out : null;
}

// Best price across all books surveyed, opening and closing. This is what a bettor who shops around
// can actually take, so it is the honest basis for return on investment. The average price is
// roughly 5% worse and is the right basis for measuring accuracy, not profit.
const openingMax = (row) => triple(row, 'MaxH', 'MaxD', 'MaxA', 'Max');
const closingMax = (row) => triple(row, 'MaxCH', 'MaxCD', 'MaxCA', 'MaxC');

// Backwards-compatible: h/d/a stay the closing average that every existing script reads.
function pickOdds(row) {
  const close = closingAvg(row) || openingAvg(row);
  if (!close) return null;
  return {
    ...close,
    open: openingAvg(row),
    openMax: openingMax(row),
    closeMax: closingMax(row),
    books: perBook(row)
  };
}

async function fetchCached(url, file) {
  const target = path.join(CACHE_DIR, file);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    const ageDays = (Date.now() - fs.statSync(target).mtimeMs) / 86400000;
    if ((!file.includes('2627') && !file.startsWith('new_')) || ageDays < 1) return fs.readFileSync(target, 'utf8');
  }
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 football-punter-research' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.includes('HomeTeam') && !text.includes('Home,')) return null;
  fs.writeFileSync(target, text);
  return text;
}

async function loadOddsRows() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const rows = [];
  for (const [code, leagues] of Object.entries(MAIN_LEAGUES)) {
    for (const season of SEASONS) {
      const text = await fetchCached(`${BASE}/mmz4281/${season}/${code}.csv`, `${season}_${code}.csv`);
      if (!text) continue;
      for (const r of parseCsv(text)) {
        const ts = parseDate(r.Date);
        const odds = pickOdds(r);
        if (!ts || !odds || r.FTHG === undefined || r.FTHG === '') continue;
        rows.push({ leagues, ts, home: r.HomeTeam, away: r.AwayTeam, hg: Number(r.FTHG), ag: Number(r.FTAG), odds });
      }
    }
  }
  for (const [code, leagues] of Object.entries(EXTRA_LEAGUES)) {
    const text = await fetchCached(`${BASE}/new/${code}.csv`, `new_${code}.csv`);
    if (!text) continue;
    for (const r of parseCsv(text)) {
      const ts = parseDate(r.Date);
      const odds = pickOdds(r);
      if (!ts || !odds || r.HG === undefined || r.HG === '') continue;
      rows.push({ leagues, ts, home: r.Home, away: r.Away, hg: Number(r.HG), ag: Number(r.AG), odds });
    }
  }
  return rows;
}

async function main() {
  const training = JSON.parse(fs.readFileSync(path.join(ROOT, 'training_data.json'), 'utf8'));
  const oddsRows = await loadOddsRows();
  console.log(`Loaded ${oddsRows.length} odds rows from football-data.co.uk`);

  // Index odds rows by league name + UTC day
  const DAY = 86400000;
  const index = new Map();
  for (const r of oddsRows) {
    for (const lg of r.leagues) {
      const key = `${lg}|${Math.floor(r.ts / DAY)}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(r);
    }
  }

  const out = {};
  const coverage = {};
  let matched = 0;
  for (const m of training) {
    if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number' || !m.timestamp) continue;
    const day = Math.floor(m.timestamp / DAY);
    const cands = [day - 1, day, day + 1].flatMap(d => index.get(`${m.league}|${d}`) || [])
      .filter(r => r.hg === m.homeScore && r.ag === m.awayScore);
    let best = null, bestScore = 0;
    for (const r of cands) {
      const sh = similarity(m.home, r.home), sa = similarity(m.away, r.away);
      const score = Math.min(sh, sa) * 0.5 + (sh + sa) / 4;
      if (Math.min(sh, sa) >= 0.3 && score > bestScore) { best = r; bestScore = score; }
    }
    coverage[m.league] = coverage[m.league] || { total: 0, matched: 0 };
    coverage[m.league].total++;
    if (best) {
      out[m.id] = {
        h: best.odds.h, d: best.odds.d, a: best.odds.a, src: best.odds.src,
        // Opening average, plus best-available prices at open and close. Null where the source did
        // not publish that column for the fixture.
        open: best.odds.open ? { h: best.odds.open.h, d: best.odds.open.d, a: best.odds.open.a, src: best.odds.open.src } : null,
        openMax: best.odds.openMax ? { h: best.odds.openMax.h, d: best.odds.openMax.d, a: best.odds.openMax.a } : null,
        closeMax: best.odds.closeMax ? { h: best.odds.closeMax.h, d: best.odds.closeMax.d, a: best.odds.closeMax.a } : null,
        // Per-book quotes as compact [home, draw, away] arrays: o = opening, c = closing.
        books: best.odds.books || null
      };
      coverage[m.league].matched++;
      matched++;
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'football-data.co.uk', matched, total: training.length, odds: out }));
  console.log(`Matched odds for ${matched}/${training.length} fixtures → ${path.relative(ROOT, OUT_FILE)}`);
  for (const [lg, c] of Object.entries(coverage).sort((a, b) => b[1].total - a[1].total).slice(0, 30)) {
    console.log(`  ${lg.padEnd(28)} ${c.matched}/${c.total} (${(c.matched / c.total * 100).toFixed(0)}%)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
