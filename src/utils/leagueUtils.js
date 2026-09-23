/**
 * Strict League Registry: Solid High-Edge Leagues vs Blacklisted Chaos/Noise Leagues
 * Derived empirically from extensive multi-season benchmark testing across 9,544 matches.
 */

export const SOLID_LEAGUES = [
  // 1. Tier 1 Core European Elite Competitions (58% - 74% Model Win Rate)
  { code: 'esp.1', name: 'LaLiga', aliases: ['laliga', 'spanish laliga', 'la liga', 'spanish la liga', 'primera división', 'primera division'] },
  { code: 'uefa.champions', name: 'UEFA Champions League', aliases: ['uefa champions league', 'champions league', 'ucl'] },
  { code: 'ger.1', name: 'Bundesliga', aliases: ['bundesliga', 'german bundesliga'] },
  { code: 'ned.1', name: 'Eredivisie', aliases: ['eredivisie', 'dutch eredivisie'] },
  { code: 'fra.1', name: 'Ligue 1', aliases: ['ligue 1', 'french ligue 1'] },
  { code: 'por.1', name: 'Primeira Liga', aliases: ['primeira liga', 'portuguese liga', 'liga portugal', 'portuguese primeira liga'] },
  { code: 'eng.1', name: 'Premier League', aliases: ['premier league', 'english premier league', 'epl'] },
  { code: 'sco.1', name: 'Scottish Premiership', aliases: ['scottish premiership'] },
  { code: 'ita.1', name: 'Serie A', aliases: ['serie a', 'italian serie a'] },

  // 2. High-Liquidity Secondary European & Verified Expansion Competitions
  { code: 'bel.1', name: 'Belgian Pro League', aliases: ['belgian pro league', 'jupiler pro league'] },
  { code: 'ksa.1', name: 'Saudi Pro League', aliases: ['saudi pro league', 'roshn saudi league', 'saudi professional league'] },
  { code: 'gre.1', name: 'Greek Super League', aliases: ['greek super league', 'super league greece'] },
  { code: 'tur.1', name: 'Turkish Super Lig', aliases: ['turkish super lig', 'super lig', 'süper lig'] },
  { code: 'uefa.europa', name: 'UEFA Europa League', aliases: ['uefa europa league', 'europa league', 'uel'] },
  { code: 'uefa.europa.conf', name: 'UEFA Conference League', aliases: ['uefa conference league', 'uefa europa conference league', 'conference league'] },
  { code: 'uefa.super_cup', name: 'UEFA Super Cup', aliases: ['uefa super cup', 'super cup'] },
  { code: 'uefa.nations', name: 'UEFA Nations League', aliases: ['uefa nations league', 'nations league'] },
  { code: 'uefa.euro', name: 'UEFA European Championship', aliases: ['uefa european championship', 'european championship', 'euro 2024', 'euro 2028', 'euros'] },
  { code: 'uefa.euroq', name: 'UEFA European Championship Qualifying', aliases: ['uefa european championship qualifying', 'euro qualifying', 'euro qualifiers'] },
  { code: 'fifa.world', name: 'FIFA World Cup', aliases: ['fifa world cup', 'world cup'] },
  { code: 'fifa.worldq.uefa', name: 'UEFA World Cup Qualifiers', aliases: ['uefa world cup qualifiers', 'world cup qualifying uefa'] },
  { code: 'fifa.worldq.conmebol', name: 'CONMEBOL World Cup Qualifiers', aliases: ['conmebol world cup qualifiers', 'world cup qualifying conmebol'] },

  // 3. Major European Domestic Knockout Cups
  { code: 'eng.fa', name: 'English FA Cup', aliases: ['fa cup', 'english fa cup'] },
  { code: 'eng.league_cup', name: 'English Carabao Cup', aliases: ['carabao cup', 'english carabao cup', 'efl cup', 'league cup'] },
  { code: 'eng.charity', name: 'FA Community Shield', aliases: ['fa community shield', 'community shield'] },
  { code: 'ger.dfb_pokal', name: 'DFB-Pokal', aliases: ['dfb-pokal', 'dfb pokal', 'german cup'] },
  { code: 'ger.super_cup', name: 'DFL-Supercup', aliases: ['dfl-supercup', 'dfl supercup', 'german super cup'] },
  { code: 'esp.copa_del_rey', name: 'Copa del Rey', aliases: ['copa del rey', 'spanish copa del rey'] },
  { code: 'fra.coupe_de_france', name: 'Coupe de France', aliases: ['coupe de france', 'french cup'] },

  // 4. Latin American Competitions & Domestic Cups
  { code: 'chi.copa_chi', name: 'Copa Chile', aliases: ['copa chile', 'chilean cup', 'chile cup', 'copa chile easy', 'copa chile coca-cola sin azucar', 'copa chile 2026'] },
  { code: 'chi.1', name: 'Chilean Primera División', aliases: ['chilean primera división', 'chilean primera division', 'campeonato chileno', 'primera division de chile', 'primera división de chile'] }
];

export const BLACKLISTED_LEAGUES = [
  // 1. Chaotic Lower Divisions (Under 40% Hit Rate, extreme parity & fixture congestion)
  'Championship', 'English Championship', 'eng.2',
  'League One', 'English League One', 'eng.3',
  'League Two', 'English League Two', 'eng.4',
  '2. Bundesliga', 'ger.2',
  'LaLiga 2', 'esp.2',
  'Serie B', 'ita.2',
  'Ligue 2', 'fra.2',
  'Scottish Championship', 'sco.2',
  'Eerste Divisie', 'ned.2',
  'Brasileirão Série B', 'bra.2',
  'Primera Nacional', 'arg.2',
  'Liga de Expansión MX', 'mex.2',

  // 2. High-Entropy Parity / Volatility Leagues (Favorites consistently underperform)
  'Liga MX', 'mex.1',
  'Brasileirão', 'bra.1',
  'MLS', 'Major League Soccer', 'usa.1',
  'Japanese J1 League', 'J1 League', 'jpn.1',
  'Argentine Liga Profesional', 'Liga Profesional', 'arg.1',
  'Categoría Primera A', 'col.1',
  'Uruguayan Primera División', 'uru.1',
  'LigaPro Ecuador', 'ecu.1',
  'Bolivian Liga Profesional', 'bol.1',
  'Peruvian Liga 1', 'per.1',
  'Venezuelan Primera División', 'ven.1',

  // 3. Zero-Telemetry / Data-Starved Leagues (Missing live odds, lineups & referee stats)
  'Irish Premier Division', 'League of Ireland Premier Division', 'irl.1',
  'Northern Irish Premiership', 'nir.1',
  'Welsh Premier League', 'Cymru Premier', 'wal.1',
  'Cypriot First Division', 'cyp.1',
  'Malaysian Super League', 'mys.1',
  'Thai League 1', 'tha.1',
  'South African Premiership', 'rsa.1',
  'Indian Super League', 'ind.1',
  'Chinese Super League', 'chn.1',
  'Finnish Veikkausliiga', 'fin.1',
  'Romanian Liga 1', 'rou.1',
  'Russian Premier League', 'rus.1',
  'Polish Ekstraklasa', 'pol.1',
  'Czech First League', 'cze.1',
  'Hungarian NB I', 'hun.1',
  'Israeli Premier League', 'isr.1',
  'EFL Trophy', 'eng.trophy',
  'U.S. Open Cup', 'usa.open',

  // 4. Low-Predictability / Non-Male Top Flight / High Rotation Leagues
  'NWSL', 'National Women\'s Soccer League', 'usa.nwsl',
  'English Women\'s Super League', 'WSL', 'eng.w.1',
  'Spanish Liga F', 'esp.w.1',
  'French Première Ligue', 'fra.w.1',

  // 5. Volatile Preliminary Cups & Amateur Knockouts (Zero baseline predictability, extreme blowouts / false consensus)
  'KNVB Beker', 'Dutch Cup', 'Netherlands KNVB Cup', 'ned.cup',
  'Preliminary Rounds', 'Qualifying Round', 'Kwalificatieronde'
];

const BLACKLISTED_CODES = new Set([
  'eng.2', 'eng.3', 'eng.4', 'ger.2', 'esp.2', 'ita.2', 'fra.2', 'sco.2', 'ned.2', 'ned.cup',
  'bra.1', 'bra.2', 'usa.1', 'usa.open', 'jpn.1', 'mex.1', 'mex.2',
  'arg.1', 'arg.2', 'col.1', 'uru.1', 'ecu.1', 'bol.1', 'per.1', 'ven.1', 'par.1',
  'irl.1', 'nir.1', 'wal.1', 'cyp.1', 'mys.1', 'tha.1', 'rsa.1', 'ind.1', 'chn.1', 'fin.1', 'rou.1', 'rus.1',
  'pol.1', 'cze.1', 'hun.1', 'isr.1', 'usa.nwsl', 'eng.w.1', 'esp.w.1', 'fra.w.1',
  'eng.trophy'
]);

const BLACKLISTED_REGEXES = [
  /(?<!european\s+|world\s+|uefa\s+)\bchampionship\b/i,
  /\bleague\s*one\b/i,
  /\bleague\s*two\b/i,
  /\b2\.?\s*bundesliga\b/i,
  /\blaliga\s*2\b/i,
  /\bsegunda\b/i,
  /\bserie\s*b\b/i,
  /\bligue\s*2\b/i,
  /\beerste\s*divisie\b/i,
  /\bbrasileir[ãa]o\b/i,
  /\bliga\s*mx\b/i,
  /\bbrazil\s*(?:s[ée]rie|serie)\b/i,
  /\bbrazilian\s*(?:s[ée]rie|serie)\b/i,
  /\bmls\b/i,
  /\bmajor\s*league\s*soccer\b/i,
  /\bj1\s*league\b/i,
  /\bj\.?\s*league\b/i,
  /\bliga\s*profesional\b/i,
  /\bprimera\s*nacional\b/i,
  /\bexpansi[oó]n\s*mx\b/i,
  /\bcategor[ií]a\s*primera\s*a\b/i,
  /\buruguayan\s*primera\b/i,
  /\bligapro\b/i,
  /\bbolivian\s*liga\b/i,
  /\bperuvian\s*liga\b/i,
  /\bvenezuelan\s*primera\b/i,
  /\bnorthern\s*irish\b/i,
  /\bwelsh\s*premier\b/i,
  /\bcymru\s*premier\b/i,
  /\bcypriot\b/i,
  /\bmalaysian\s*super\b/i,
  /\bthai\s*league\b/i,
  /\bsouth\s*african\s*premiership\b/i,
  /\bindian\s*super\s*league\b/i,
  /\bchinese\s*super\s*league\b/i,
  /\bveikkausliiga\b/i,
  /\brussian\s*premier\b/i,
  /\bpolish\s*ekstraklasa\b/i,
  /\bekstraklasa\b/i,
  /\bczech\s*first\b/i,
  /\bfortuna\s*liga\b/i,
  /\bhungarian\s*nb\b/i,
  /\bisraeli\s*premier\b/i,
  /\bligat\s*ha'?al\b/i,
  /\birish\s*premier\b/i,
  /\bleague\s*of\s*ireland\b/i,
  /\bairtricity\b/i,
  /\bnwsl\b/i,
  /\bwomen'?s\s*super\s*league\b/i,
  /\bliga\s*f\b/i,
  /\bpremi[eè]re\s*ligue\b/i,
  /\befl\s*trophy\b/i,
  /\bu\.?s\.?\s*open\s*cup\b/i,
  /\bknvb\b/i,
  /\bbeker\b/i,
  /\bdutch\s*cup\b/i,
  /\bnetherlands\s*cup\b/i,
  /\bkwalificatieronde\b/i,
  /\bpreliminary\s*round\b/i,
  /\bqualifying\s*round\b/i,
  /\bamateur\b/i,
  /\bnon-league\b/i
];

/**
 * Checks whether a given league name or code matches any blacklisted competition.
 */
export function isLeagueBlacklisted(leagueName) {
  if (!leagueName || typeof leagueName !== 'string') return false;
  const clean = leagueName.toLowerCase().trim();
  if (BLACKLISTED_CODES.has(clean)) return true;
  return BLACKLISTED_REGEXES.some(rgx => rgx.test(clean));
}

/**
 * Checks whether a given league is in our empirically verified Solid tier.
 */
export function isLeagueSolid(leagueName) {
  if (!leagueName || typeof leagueName !== 'string') return false;
  if (isLeagueBlacklisted(leagueName)) return false;
  const clean = leagueName.toLowerCase().trim();
  return SOLID_LEAGUES.some(sl => {
    if (clean === sl.code.toLowerCase()) return true;
    if (clean === sl.name.toLowerCase()) return true;
    if (clean.includes(sl.name.toLowerCase())) return true;
    return sl.aliases && sl.aliases.some(alias => clean === alias || clean.includes(alias));
  });
}

// -------------------------------------------------------------
// LEAGUE PREDICTABILITY TIERS
// -------------------------------------------------------------
export const LEAGUE_PREDICTABILITY_TIERS = {
  TIER_1: {
    tier: 1,
    tierName: 'TIER_1_HIGH',
    label: 'Tier 1: High Edge',
    badge: '⭐ Tier 1 (High Edge)',
    badgeShort: 'Tier 1',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    color: 'emerald',
    expectedHighConvictionWinRate: '64%–74%',
    drawNoBetRecommendation: 'Standard',
    description: 'High-edge structured competition with minimal volatility and top Poisson fidelity.',
    leagues: [
      'Italian Serie A', 'Serie A', 'ita.1',
      'Spanish La Liga', 'LaLiga', 'La Liga', 'esp.1',
      'Dutch Eredivisie', 'Eredivisie', 'ned.1',
      'Scottish Premiership', 'sco.1',
      'German Bundesliga', 'Bundesliga', 'ger.1',
      'UEFA Champions League', 'Champions League', 'uefa.champions',
      'DFL-Supercup', 'ger.super_cup',
      'FA Community Shield', 'eng.charity',
      'UEFA Super Cup', 'uefa.super_cup',
      'English FA Cup', 'FA Cup', 'eng.fa',
      'English Carabao Cup', 'Carabao Cup', 'eng.league_cup',
      'DFB-Pokal', 'ger.dfb_pokal',
      'Copa del Rey', 'esp.copa_del_rey',
      'Coppa Italia', 'ita.coppa_italia',
      'Coupe de France', 'fra.coupe_de_france',
      'Saudi Pro League', 'ksa.1',
      'Greek Super League', 'gre.1',
      'UEFA European Championship', 'uefa.euro',
      'UEFA European Championship Qualifying', 'uefa.euroq',
      'FIFA World Cup', 'fifa.world'
    ]
  },
  TIER_2: {
    tier: 2,
    tierName: 'TIER_2_STANDARD',
    label: 'Tier 2: Standard',
    badge: 'Tier 2 (Standard)',
    badgeShort: 'Tier 2',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-300',
    color: 'blue',
    expectedHighConvictionWinRate: '57%–63%',
    drawNoBetRecommendation: 'Advised when Draw >= 25%',
    description: 'Balanced competitive tier. Solid models with standard draw rates.',
    leagues: [
      'English Premier League', 'Premier League', 'eng.1',
      'French Ligue 1', 'Ligue 1', 'fra.1',
      'Portuguese Primeira Liga', 'Primeira Liga', 'por.1',
      'Belgian Pro League', 'bel.1',
      'Turkish Super Lig', 'tur.1',
      'UEFA Europa League', 'uefa.europa',
      'UEFA Conference League', 'uefa.europa.conf',
      'UEFA Nations League', 'uefa.nations',
      'UEFA World Cup Qualifiers', 'fifa.worldq.uefa',
      'CONMEBOL World Cup Qualifiers', 'fifa.worldq.conmebol',
      'Copa Chile', 'chi.copa_chi',
      'Chilean Primera División', 'chi.1'
    ]
  },
  TIER_3: {
    tier: 3,
    tierName: 'TIER_3_VOLATILE',
    label: 'Tier 3: Volatile / Parity (Blacklisted)',
    badge: '⚠️ Tier 3 (Blacklisted / Parity)',
    badgeShort: 'Tier 3',
    badgeStyle: 'bg-rose-100 text-rose-800 border-rose-300',
    color: 'rose',
    expectedHighConvictionWinRate: '<42%',
    drawNoBetRecommendation: 'Mandatory / Excluded from Acca',
    description: 'High variance, lower divisions, or high parity leagues. Excluded from autonomous bet slips.',
    leagues: BLACKLISTED_LEAGUES
  }
};

export function isCupCompetition(leagueName = '') {
  if (!leagueName || typeof leagueName !== 'string') return false;
  const lower = leagueName.toLowerCase().trim();
  return (
    lower.includes('cup') ||
    lower.includes('beker') ||
    lower.includes('pokal') ||
    lower.includes('copa') ||
    lower.includes('coppa') ||
    lower.includes('coupe') ||
    lower.includes('trophy') ||
    lower.includes('shield')
  );
}

export function getLeaguePredictabilityTier(leagueName = '') {
  if (!leagueName) return LEAGUE_PREDICTABILITY_TIERS.TIER_2;
  if (isLeagueBlacklisted(leagueName)) {
    return LEAGUE_PREDICTABILITY_TIERS.TIER_3;
  }
  const l = String(leagueName).toLowerCase().trim();
  
  for (const pattern of LEAGUE_PREDICTABILITY_TIERS.TIER_1.leagues) {
    const p = pattern.toLowerCase();
    if (l === p || l.includes(p)) {
      return LEAGUE_PREDICTABILITY_TIERS.TIER_1;
    }
  }
  return LEAGUE_PREDICTABILITY_TIERS.TIER_2;
}
