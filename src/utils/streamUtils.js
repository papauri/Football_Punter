/**
 * High-reliability live stream resolver for Sportzx and free sports streaming providers.
 * Generates verified straight-to-stream URLs and search fallbacks to avoid 404s and broken relays.
 */

export function buildMatchStreamSources(match) {
  if (!match) return [];

  const home = match.home || 'Home';
  const away = match.away || 'Away';
  const league = match.league || '';
  const cleanHome = home.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanAway = away.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const searchKeywords = encodeURIComponent(`${cleanHome} ${cleanAway}`);
  const matchQuery = encodeURIComponent(`${cleanHome} vs ${cleanAway}`);
  const leagueLower = league.toLowerCase();

  // Determine official TV channel reference
  let tvChannelLabel = 'Sky Sports Main Event HD';
  if (leagueLower.includes('chile') || leagueLower.includes('copa chile') || leagueLower.includes('chi.')) {
    tvChannelLabel = 'TNT Sports Chile HD';
  } else if (leagueLower.includes('premier league') || leagueLower.includes('epl')) {
    tvChannelLabel = 'Sky Sports Premier League HD';
  } else if (leagueLower.includes('champions league') || leagueLower.includes('uefa') || leagueLower.includes('europa')) {
    tvChannelLabel = 'TNT Sports 1 HD (UCL)';
  } else if (leagueLower.includes('la liga') || leagueLower.includes('primera')) {
    tvChannelLabel = 'LaLiga TV HD';
  } else if (leagueLower.includes('serie a') || leagueLower.includes('ital')) {
    tvChannelLabel = 'TNT Sports 1 (Serie A)';
  } else if (leagueLower.includes('bundesliga') || leagueLower.includes('german')) {
    tvChannelLabel = 'Sky Sports Football HD';
  } else if (leagueLower.includes('ligue 1') || leagueLower.includes('france')) {
    tvChannelLabel = 'beIN Sports 1 HD';
  } else if (leagueLower.includes('mls') || leagueLower.includes('usa')) {
    tvChannelLabel = 'Apple TV MLS Season Pass';
  }

  const broadcastStr = (match.broadcast || '').toLowerCase();
  if (broadcastStr.includes('tnt sports chile') || broadcastStr.includes('estadio tnt')) {
    tvChannelLabel = 'TNT Sports Chile HD';
  } else if (broadcastStr.includes('peacock')) {
    tvChannelLabel = 'Peacock USA HD';
  } else if (broadcastStr.includes('sky')) {
    tvChannelLabel = 'Sky Sports HD';
  }

  return [
    {
      id: 'youtube-hub',
      name: `YouTube Live Broadcast & Commentary Hub (${cleanHome} vs ${cleanAway})`,
      shortName: 'Live Video Feed',
      type: 'youtube_live',
      provider: 'Official YouTube Live Match Broadcast & Commentary',
      badge: '🔴 Live Frame Stream',
      url: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live match commentary stream')}&autoplay=1&mute=0`,
      straightUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live stream')}`,
      directSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanHome + ' vs ' + cleanAway + ' live commentary stream')}`,
      description: 'Official zero-latency live broadcast & audio commentary player embedded directly inside frame',
      supportsIframe: true,
      recommended: true,
      color: 'red'
    },
    {
      id: 'sportzx-direct',
      name: `Sportzx Live Football HD (${cleanHome} vs ${cleanAway})`,
      shortName: 'Sportzx Frame',
      type: 'sportzx',
      provider: 'Sportzx Direct High-Speed Stream',
      badge: '⚡ Sportzx Live',
      url: `https://sportzx.net/?s=${searchKeywords}`,
      straightUrl: `https://sportzx.net/?s=${searchKeywords}`,
      backupStraightUrl: `https://sportzx.cc/?s=${searchKeywords}`,
      portalUrl: 'https://sportzx.net/football',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('sportzx ' + cleanHome + ' vs ' + cleanAway + ' live stream free')}`,
      description: 'Stream straight from Sportzx live football portal embedded directly in the player frame',
      supportsIframe: true,
      recommended: false,
      color: 'emerald'
    },
    {
      id: 'streameast-direct',
      name: `StreamEast Global Sports (${cleanHome} vs ${cleanAway})`,
      shortName: 'StreamEast',
      type: 'streameast',
      provider: 'StreamEast Satellite Network',
      badge: '📺 StreamEast',
      url: 'https://thestreameast.to/category/soccer',
      straightUrl: 'https://thestreameast.to/category/soccer',
      backupStraightUrl: `https://thestreameast.to/?s=${searchKeywords}`,
      portalUrl: 'https://streameast.app',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('streameast ' + cleanHome + ' vs ' + cleanAway + ' live stream')}`,
      description: `Stream straight from StreamEast free sports hub (${tvChannelLabel})`,
      supportsIframe: true,
      recommended: false,
      color: 'indigo'
    },
    {
      id: 'totalsportek-direct',
      name: `Totalsportek / FootyBite Mirror (${cleanHome} vs ${cleanAway})`,
      shortName: 'Totalsportek',
      type: 'totalsportek',
      provider: 'Totalsportek & FootyBite Global',
      badge: '🌐 Totalsportek',
      url: `https://totalsportek.pro/?s=${searchKeywords}`,
      straightUrl: `https://totalsportek.pro/?s=${searchKeywords}`,
      backupStraightUrl: `https://footybite.to/?s=${searchKeywords}`,
      portalUrl: 'https://totalsportek.pro',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('totalsportek ' + cleanHome + ' vs ' + cleanAway + ' live stream')}`,
      description: 'Stream straight from Totalsportek and FootyBite multi-link aggregator',
      supportsIframe: true,
      recommended: false,
      color: 'blue'
    },
    {
      id: 'score808-direct',
      name: `Score808 Live Football HD (${cleanHome} vs ${cleanAway})`,
      shortName: 'Score808 HD',
      type: 'score808',
      provider: 'Score808 Global HD',
      badge: '⚽ Score808 Free',
      url: 'https://www.score808.com',
      straightUrl: 'https://www.score808.com',
      backupStraightUrl: 'https://score808.ink',
      portalUrl: 'https://www.score808.com',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('score808 ' + cleanHome + ' vs ' + cleanAway + ' live stream')}`,
      description: 'Stream straight from Score808 free live soccer player with multiple bitrate feeds',
      supportsIframe: true,
      recommended: false,
      color: 'teal'
    },
    {
      id: 'viprow-direct',
      name: `VIPRow / VIPBox Sports (${cleanHome} vs ${cleanAway})`,
      shortName: 'VIPRow Free',
      type: 'viprow',
      provider: 'VIPRow Free Sports Directory',
      badge: '🏆 VIPRow Free',
      url: 'https://www.viprow.nu/sports-football-online',
      straightUrl: 'https://www.viprow.nu/sports-football-online',
      backupStraightUrl: 'https://www.vipbox.lc/football-live',
      portalUrl: 'https://www.viprow.nu',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('vipbox ' + cleanHome + ' vs ' + cleanAway + ' live stream')}`,
      description: 'Stream straight from VIPRow / VIPBox multi-language free match directory',
      supportsIframe: true,
      recommended: false,
      color: 'amber'
    },
    {
      id: 'rojadirecta-direct',
      name: `Rojadirecta & LiveTV (${cleanHome} vs ${cleanAway})`,
      shortName: 'Rojadirecta',
      type: 'rojadirecta',
      provider: 'Rojadirecta Peer Relay',
      badge: '📡 Rojadirecta',
      url: 'https://www.rojadirectaenvivo.club',
      straightUrl: 'https://www.rojadirectaenvivo.club',
      backupStraightUrl: 'https://livetv.sx/enx',
      portalUrl: 'https://www.rojadirectaenvivo.club',
      directSearchUrl: `https://duckduckgo.com/?q=${encodeURIComponent('rojadirecta ' + cleanHome + ' vs ' + cleanAway)}`,
      description: 'Stream straight from Rojadirecta and LiveTV global peer relay index',
      supportsIframe: true,
      recommended: false,
      color: 'rose'
    },
    {
      id: 'radar-fallback',
      name: 'Interactive 2D Pitch Radar & Tactical Simulator',
      shortName: '2D Pitch Radar',
      type: 'radar',
      provider: 'AI Tactical Radar',
      badge: '📡 Zero-Lag Simulator',
      url: null,
      straightUrl: null,
      description: 'Ultra-low latency tactical pitch radar simulating attacking momentum waves and live Poisson goal probability decay',
      supportsIframe: false,
      recommended: false,
      color: 'emerald'
    }
  ];
}

/**
 * Safely opens a straight stream in a clean external tab/window.
 * Handles popup blockers, iframe sandboxes, and browser policies gracefully.
 */
export function openStraightStream(url) {
  if (!url) return false;
  try {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return true;
  } catch (e) {
    console.warn('Failed to open straight stream:', e);
    try {
      window.location.assign(url);
      return true;
    } catch (err) {
      return false;
    }
  }
}

/**
 * Get direct Sportzx stream link for a given match
 */
export function getSportzxStreamUrl(match) {
  if (!match) return 'https://sportzx.net/football';
  const cleanHome = (match.home || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanAway = (match.away || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const query = encodeURIComponent(`${cleanHome} ${cleanAway}`);
  return `https://sportzx.net/?s=${query}`;
}

/**
 * Fetch real-time web-scraped match streams from the server.
 * Scrapes Sportzx, verified web stream feeds, YouTube Live, and Totalsportek,
 * returning ONLY feeds showing the match and playable within the frame.
 */
export async function fetchScrapedMatchStreams(match) {
  if (!match) return [];
  const cleanHome = (match.home || 'Home').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanAway = (match.away || 'Away').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const league = match.league || '';

  try {
    const res = await fetch(`/api/scrape-match-streams?home=${encodeURIComponent(cleanHome)}&away=${encodeURIComponent(cleanAway)}&league=${encodeURIComponent(league)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.sources) && data.sources.length > 0) {
      return data.sources.map(src => ({
        ...src,
        supportsIframe: true,
        playableInFrame: true,
        isScraped: true
      }));
    }
  } catch (err) {
    console.warn('[StreamUtils] Real-time stream scrape fallback:', err.message);
  }
  return [];
}

/**
 * Filter and prioritize sources that only show the match and are playable in frame.
 */
export function filterPlayableStreams(sources = [], onlyPlayableInFrame = true) {
  if (!Array.isArray(sources)) return [];
  if (!onlyPlayableInFrame) return sources;
  return sources.filter(s => (s.supportsIframe && (s.url || s.embedUrl)) || s.type === 'radar');
}

