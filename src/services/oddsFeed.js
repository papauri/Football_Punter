// Multi-book odds feed.
//
// WHY THIS MATTERS MORE THAN THE MODEL
//
// Measured over the rolling walk-forward, the published picks returned -4.15% at the market average
// price and -1.16% at the best available price. That three-point difference is larger than every
// modelling change in this project combined. It is not a modelling problem: the average price carries
// about 5.5% margin at the close while the best price across books carries about 1.9%, and on the
// historical per-book data Pinnacle alone runs at 3.1%. Most of the loss was margin, not error.
//
// Two distinct uses, and they must not be confused:
//   BEST PRICE  — the highest quote across books, which is what you actually bet into.
//   SHARP PRICE — a low-margin, high-limit book (Pinnacle first choice). De-vigged, this is the best
//                 public estimate of a true probability, so it is the yardstick for measuring whether
//                 a price was good. Never bet into the sharp price as if it were the best price, and
//                 never judge yourself against the best price as if it were fair.
//
// DEGRADATION IS EXPLICIT
//
// Without ODDS_API_KEY there is no multi-book feed, and this module says so rather than quietly
// returning one book's quote dressed up as a consensus. A single-provider quote is returned with
// bookCount 1 and multiBook false, so callers can refuse to claim a best price they do not have.

const SHARP_PREFERENCE = ['pinnacle', 'betfair_ex_uk', 'betfair_ex_eu', 'smarkets', 'matchbook'];

// The Odds API region groups. Europe carries the sharp books that matter here.
const DEFAULT_REGIONS = 'eu,uk';
const API_BASE = 'https://api.the-odds-api.com/v4';

export function oddsFeedStatus() {
  const key = process.env.ODDS_API_KEY;
  return {
    multiBookAvailable: Boolean(key),
    provider: key ? 'the-odds-api' : null,
    reason: key ? null : 'ODDS_API_KEY is not set, so only the single-provider ESPN quote is available',
    sharpPreference: SHARP_PREFERENCE
  };
}

/**
 * Normalise a set of per-book 1X2 quotes into best price, sharp reference and de-vigged fair probs.
 *
 * @param {Object} books  { bookName: { h, d, a } }
 * @returns {Object|null}
 */
export function summariseBooks(books) {
  const names = Object.keys(books || {}).filter(n => {
    const b = books[n];
    return b && b.h > 1 && b.d > 1 && b.a > 1;
  });
  if (!names.length) return null;

  // Best available: the highest quote for each outcome, across books. Note this is not a bettable
  // "book" — each leg may sit with a different bookmaker, which is exactly how line shopping works.
  const best = {
    h: Math.max(...names.map(n => books[n].h)),
    d: Math.max(...names.map(n => books[n].d)),
    a: Math.max(...names.map(n => books[n].a))
  };
  best.source = {
    h: names.find(n => books[n].h === best.h),
    d: names.find(n => books[n].d === best.d),
    a: names.find(n => books[n].a === best.a)
  };

  const sharpName = SHARP_PREFERENCE.find(s => names.some(n => n.toLowerCase().includes(s)))
    ? names.find(n => SHARP_PREFERENCE.some(s => n.toLowerCase().includes(s)))
    : null;
  const sharp = sharpName ? { ...books[sharpName], book: sharpName } : null;

  // Fair probabilities come from the sharp book where we have one, else from the median quote across
  // books, which is more robust than the mean to one book being stale or wrong.
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const reference = sharp || {
    h: median(names.map(n => books[n].h)),
    d: median(names.map(n => books[n].d)),
    a: median(names.map(n => books[n].a)),
    book: 'median-of-books'
  };
  const inv = [1 / reference.h, 1 / reference.d, 1 / reference.a];
  const overround = inv[0] + inv[1] + inv[2];

  return {
    bookCount: names.length,
    books,
    best,
    sharp,
    referenceBook: reference.book,
    fairProb: {
      home: inv[0] / overround * 100,
      draw: inv[1] / overround * 100,
      away: inv[2] / overround * 100
    },
    referenceOverround: (overround - 1) * 100,
    bestOverround: (1 / best.h + 1 / best.d + 1 / best.a - 1) * 100
  };
}

/**
 * Fetch current 1X2 quotes across books for upcoming soccer fixtures.
 * Returns [] when no API key is configured — deliberately, rather than faking a consensus.
 *
 * @param {Object} [options]
 * @param {string} [options.sport='soccer_epl'] The Odds API sport key
 * @param {string} [options.regions]
 * @returns {Promise<Array>} [{ commenceTime, home, away, summary }]
 */
export async function fetchMultiBookOdds(options = {}) {
  const key = process.env.ODDS_API_KEY;
  if (!key) return { available: false, reason: oddsFeedStatus().reason, fixtures: [] };

  const sport = options.sport || 'soccer_epl';
  const regions = options.regions || process.env.ODDS_API_REGIONS || DEFAULT_REGIONS;
  const url = `${API_BASE}/sports/${encodeURIComponent(sport)}/odds?regions=${encodeURIComponent(regions)}&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      return { available: false, reason: `the-odds-api returned HTTP ${res.status}`, fixtures: [] };
    }
    const data = await res.json();
    // Remaining request quota, so a caller can avoid burning a monthly allowance.
    const quota = {
      remaining: Number(res.headers.get('x-requests-remaining')) || null,
      used: Number(res.headers.get('x-requests-used')) || null
    };

    const fixtures = [];
    for (const ev of Array.isArray(data) ? data : []) {
      const books = {};
      for (const bm of ev.bookmakers || []) {
        const market = (bm.markets || []).find(m => m.key === 'h2h');
        if (!market) continue;
        const home = market.outcomes?.find(o => o.name === ev.home_team)?.price;
        const away = market.outcomes?.find(o => o.name === ev.away_team)?.price;
        const draw = market.outcomes?.find(o => o.name === 'Draw')?.price;
        if (home > 1 && draw > 1 && away > 1) books[bm.key] = { h: home, d: draw, a: away, lastUpdate: bm.last_update };
      }
      const summary = summariseBooks(books);
      if (summary) {
        fixtures.push({
          commenceTime: ev.commence_time,
          home: ev.home_team,
          away: ev.away_team,
          summary
        });
      }
    }
    return { available: true, provider: 'the-odds-api', quota, fixtures };
  } catch (e) {
    return { available: false, reason: `the-odds-api request failed: ${e.message}`, fixtures: [] };
  }
}

/**
 * Wrap a single-provider quote (e.g. the ESPN consensus the app already reads) in the same shape,
 * flagged so nothing downstream mistakes it for a shopped best price.
 */
export function singleProviderQuote(provider, h, d, a) {
  if (!(h > 1 && d > 1 && a > 1)) return null;
  const summary = summariseBooks({ [provider || 'single']: { h, d, a } });
  if (!summary) return null;
  return {
    ...summary,
    multiBook: false,
    // With one book there is no best price to speak of and no sharp reference: the "fair" probability
    // here is just that book's line with its own margin removed, which flatters it.
    caveat: 'Single provider. bestPrice equals this book\'s price, and fairProb carries this book\'s bias.'
  };
}

export { SHARP_PREFERENCE };
