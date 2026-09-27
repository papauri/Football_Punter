import React, { useState, useEffect, useRef, useMemo } from 'react';
import MobileViewSwitcher from './MobileViewSwitcher';
import { useMobileViewMode } from '../utils/useMobileViewMode';
import { MobileFoldCell, MobileFoldBlock, FoldSummary, FoldBadge, compactKickoff } from './MobileFold';
import { 
  Target, AlertCircle, RefreshCw, ChevronRight, Activity, Zap, 
  ShieldCheck, TrendingUp, SlidersHorizontal, Search, Check, Plus, 
  Flag, Award, Sparkles, ChevronDown, ChevronUp, Clock,
  Copy, CheckCircle2
} from 'lucide-react';
import { formatRelativeDayTime, formatSafeDateTime } from '../utils/dateUtils';
import UniformDropdown from './UniformDropdown';

export default function PropsSpecialsPage({
  matches = [],
  allMatches = [],
  tzSettings,
  onAddToSlip,
  accaPicks = [],
  accaMatchIds = new Set(),
  onOpenDeepResearch,
  betSlips = [],
  activeSlipId = 'props-slip',
  onSetActiveSlipId,
  onUpdateBetSlips,
  onNavigate
}) {
  // Shared with every list page: Cards or 1-Row Table on phones, remembered across pages.
  const [mobileViewMode] = useMobileViewMode();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL'); // 'ALL' | 'BTTS' | 'CORNERS' | 'CARDS' | 'SPECIALS'
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [minHitRate, setMinHitRate] = useState(60); // 60, 70, 75, 80
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInsights, setExpandedInsights] = useState(new Set());
  const [expandedEvalId, setExpandedEvalId] = useState(null);

  // Verified Past Performance filters & pagination
  const [evalOutcomeFilter, setEvalOutcomeFilter] = useState('ALL'); // 'ALL' | 'HITS' | 'MISSES'
  const [evalCategoryFilter, setEvalCategoryFilter] = useState('ALL'); // 'ALL' | 'CORNERS' | 'CARDS' | 'BTTS' | 'SPECIALS'
  const [evalLeagueFilter, setEvalLeagueFilter] = useState('ALL');
  const [evalSearch, setEvalSearch] = useState('');
  const [evalPage, setEvalPage] = useState(1);
  const evalPageSize = 6;

  // Match Prop Analysis pagination
  const [propsPage, setPropsPage] = useState(1);
  const propsPageSize = 8;

  // Reset pagination when match prop filters change
  useEffect(() => {
    setPropsPage(1);
  }, [selectedLeague, searchQuery, selectedCategory, minHitRate]);

  // Reset eval pagination when eval filters change
  useEffect(() => {
    setEvalPage(1);
  }, [evalOutcomeFilter, evalCategoryFilter, evalLeagueFilter, evalSearch]);

  const toggleEvalExpand = (id) => {
    setExpandedEvalId(prev => (prev === id ? null : id));
  };
  const [collapsedPropsProof, setCollapsedPropsProof] = useState(false);
  const [collapsedMatchProps, setCollapsedMatchProps] = useState(false);
  const [loadedNotice, setLoadedNotice] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchProps = async (force = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setLoading(true);
    setError(null);
    try {
      const availableMatches = (matches && matches.length > 0) ? matches : allMatches;
      const res = await fetch('/api/props-specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          limit: 12, 
          forceRefresh: force,
          matches: (availableMatches && availableMatches.length > 0) ? availableMatches.slice(0, 15) : undefined
        }),
        signal: abortCtrl.signal
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to analyze props');
      setData(json.result);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (abortControllerRef.current === abortCtrl) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProps(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const toggleExpand = (matchId) => {
    setExpandedInsights(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const propsSlip = betSlips?.find(s => s.id === 'props-slip');
  const propsSlipPicks = propsSlip?.picks || [];

  const isPropInPropsSlip = (matchId, propLabel) => {
    return propsSlipPicks.some(p => 
      (p.id === matchId || p.pickId?.includes(matchId)) && 
      (p.pick === propLabel || p.market?.includes(propLabel))
    );
  };

  // Helper to check if a specific prop is already in slip
  const isPropInSlip = (matchId, propLabel) => {
    const pickKey = `${matchId}_${propLabel}`;
    return isPropInPropsSlip(matchId, propLabel) || accaMatchIds.has(pickKey) || (accaPicks && accaPicks.some(p => 
      (p.id === matchId || p.pickId === pickKey || p.pickId?.startsWith(matchId)) && 
      (p.pick === propLabel || p.market?.includes(propLabel))
    ));
  };

  // Extract unique leagues with counts for the dropdown
  const leagueOptions = useMemo(() => {
    if (!data?.insights) return [{ value: 'All', label: 'All Leagues' }];
    const counts = {};
    data.insights.forEach(ins => {
      if (ins.league) {
        counts[ins.league] = (counts[ins.league] || 0) + 1;
      }
    });
    const sorted = Object.keys(counts).sort();
    return [
      { value: 'All', label: `All Leagues (${data.insights.length})` },
      ...sorted.map(lg => ({ value: lg, label: `${lg} (${counts[lg]})` }))
    ];
  }, [data]);

  // Filtered insights according to user criteria
  const filteredInsights = useMemo(() => {
    if (!data?.insights) return [];
    return data.insights.filter(insight => {
      // League filter
      if (selectedLeague !== 'All' && insight.league !== selectedLeague) {
        return false;
      }

      // Search query: match team names, league, or prop labels
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (insight.home || '').toLowerCase();
        const away = (insight.away || '').toLowerCase();
        const league = (insight.league || '').toLowerCase();
        const hasMatchingProp = (insight.structuredProps || []).some(p => 
          (p.label || '').toLowerCase().includes(q) || (p.market || '').toLowerCase().includes(q)
        );
        if (!home.includes(q) && !away.includes(q) && !league.includes(q) && !hasMatchingProp) {
          return false;
        }
      }

      // Props hit rate / category matching
      if (insight.structuredProps && insight.structuredProps.length > 0) {
        const matchingProps = insight.structuredProps.filter(p => {
          if (selectedCategory !== 'ALL' && p.market !== selectedCategory) return false;
          if (p.hitProbability < minHitRate) return false;
          return true;
        });
        return matchingProps.length > 0;
      }
      return true;
    });
  }, [data, selectedLeague, searchQuery, selectedCategory, minHitRate]);

  // Pagination for Match Prop Analysis
  const propsTotalPages = Math.max(1, Math.ceil(filteredInsights.length / propsPageSize));
  const paginatedInsights = useMemo(() => {
    const start = (propsPage - 1) * propsPageSize;
    return filteredInsights.slice(start, start + propsPageSize);
  }, [filteredInsights, propsPage, propsPageSize]);

  // Helper to extract category if market isn't explicit
  const getEvalCategory = (ev) => {
    if (ev.market) return ev.market.toUpperCase();
    const p = (ev.propPick || '').toLowerCase();
    if (p.includes('corner')) return 'CORNERS';
    if (p.includes('card') || p.includes('booking')) return 'CARDS';
    if (p.includes('btts') || p.includes('both teams')) return 'BTTS';
    return 'SPECIALS';
  };

  // Evaluation counts for filter tabs
  const evalCounts = useMemo(() => {
    const list = data?.recentEvaluations || [];
    const hits = list.filter(e => e.isHit).length;
    const misses = list.length - hits;
    return { total: list.length, hits, misses };
  }, [data]);

  // League options for Verified Past Performance
  const evalLeagueOptions = useMemo(() => {
    if (!data?.recentEvaluations) return [{ value: 'ALL', label: 'All Leagues' }];
    const counts = {};
    data.recentEvaluations.forEach(ev => {
      if (ev.league) counts[ev.league] = (counts[ev.league] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort();
    return [
      { value: 'ALL', label: `All Leagues (${data.recentEvaluations.length})` },
      ...sorted.map(lg => ({ value: lg, label: `${lg} (${counts[lg]})` }))
    ];
  }, [data]);

  // Filtered Verified Past Performance
  const filteredEvaluations = useMemo(() => {
    if (!data?.recentEvaluations) return [];
    return data.recentEvaluations.filter(ev => {
      // Outcome filter
      if (evalOutcomeFilter === 'HITS' && !ev.isHit) return false;
      if (evalOutcomeFilter === 'MISSES' && ev.isHit) return false;

      // Category filter
      if (evalCategoryFilter !== 'ALL') {
        const cat = getEvalCategory(ev);
        if (cat !== evalCategoryFilter) return false;
      }

      // League filter
      if (evalLeagueFilter !== 'ALL' && ev.league !== evalLeagueFilter) return false;

      // Search query
      if (evalSearch.trim()) {
        const q = evalSearch.toLowerCase();
        const text = `${ev.home || ''} ${ev.away || ''} ${ev.league || ''} ${ev.propPick || ''} ${ev.actualResult || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [data, evalOutcomeFilter, evalCategoryFilter, evalLeagueFilter, evalSearch]);

  const evalTotalPages = Math.max(1, Math.ceil(filteredEvaluations.length / evalPageSize));
  const paginatedEvaluations = useMemo(() => {
    const start = (evalPage - 1) * evalPageSize;
    return filteredEvaluations.slice(start, start + evalPageSize);
  }, [filteredEvaluations, evalPage, evalPageSize]);

  // Extract all high-conviction props across filtered matches for the quick-add action
  const allEliteAnchors = useMemo(() => {
    if (!filteredInsights) return [];
    const list = [];
    filteredInsights.forEach(insight => {
      const originalMatch = matches.find(m => m.id === insight.matchId) || {
        id: insight.matchId,
        home: insight.home,
        away: insight.away,
        league: insight.league,
        date: insight.date,
        time: insight.time,
        timestamp: insight.timestamp,
        utcDate: insight.utcDate,
        dateIso: insight.dateIso
      };

      (insight.structuredProps || []).forEach(prop => {
        if (prop.confidenceTier === 'ELITE_ANCHOR') {
          list.push({
            match: originalMatch,
            prop,
            inSlip: isPropInSlip(insight.matchId, prop.label)
          });
        }
      });
    });
    return list.sort((a, b) => b.prop.hitProbability - a.prop.hitProbability);
  }, [filteredInsights, matches, accaPicks, accaMatchIds, propsSlipPicks]);


  const handleAddTopAnchors = () => {
    if (!onAddToSlip || allEliteAnchors.length === 0) return;
    const seenMatches = new Set();
    const available = [];
    for (const item of allEliteAnchors) {
      if (item.inSlip) continue;
      const matchId = String(item.match?.id || item.match?.espnEventId || `${item.match?.home}-${item.match?.away}`);
      if (!seenMatches.has(matchId)) {
        seenMatches.add(matchId);
        available.push(item);
        if (available.length >= 3) break;
      }
    }
    available.forEach(item => {
      onAddToSlip(
        item.match,
        item.prop.label,
        `Props: ${item.prop.market}`,
        item.prop.fairOdds,
        item.prop.hitProbability,
        'props-slip'
      );
    });
    setLoadedNotice(`Added ${available.length} tips to your corners & cards slip.`);
    setTimeout(() => setLoadedNotice(null), 4000);
  };

  const formatMatchKickoff = (insight) => {
    const res = formatRelativeDayTime(insight, tzSettings);
    return res !== 'Upcoming' ? res : (insight.time || 'Upcoming');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Corners &amp; cards</h1>
            <p className="text-[11px] text-slate-500">Corners, cards and both teams to score. Corners and cards cover the top 14 European leagues.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {propsSlipPicks.length > 0 && (
              <button
                onClick={() => { onSetActiveSlipId?.('props-slip'); onNavigate?.('acca'); }}
                className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                View slip ({propsSlipPicks.length})
              </button>
            )}
            {allEliteAnchors.some(a => !a.inSlip) && (
              <button
                onClick={handleAddTopAnchors}
                className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Add the strongest tips to your corners & cards slip"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{allEliteAnchors.length < 3 ? `Add top ${allEliteAnchors.length} to slip` : 'Add top 3 to slip'}</span>
              </button>
            )}
            <button
              onClick={() => fetchProps(true)}
              disabled={loading}
              className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <div className="text-[11px] text-slate-500" title="How often the strongest corners or cards tip came in, on past matches the model had not seen">Past hit rate, strongest tip</div>
            <div className="text-base font-bold text-slate-900">
              {data?.overallAccuracy || '—'}
              {data?.totalEvaluated ? <span className="text-[11px] font-normal text-slate-500 ml-1">({data.totalEvaluated.toLocaleString()} matches)</span> : null}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <div className="text-[11px] text-slate-500">Strong tips available</div>
            <div className="text-base font-bold text-emerald-700">{allEliteAnchors.length}</div>
          </div>
        </div>
      </div>

      {/* Loaded Notification Banner */}
      {loadedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{loadedNotice}</span>
          </div>
          {onNavigate && (
            <button
              onClick={() => {
                onSetActiveSlipId?.('props-slip');
                onNavigate('acca');
              }}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
            >
              Open slip &rarr;
            </button>
          )}
        </div>
      )}

      {/* Filter & Market Navigation Controls */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Search Bar */}
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team, league, prop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right: Dropdowns & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <UniformDropdown
              label="Market"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'ALL', label: 'All markets' },
                { value: 'BTTS', label: 'Both teams score' },
                { value: 'CORNERS', label: 'Corners' },
                { value: 'CARDS', label: 'Cards' },
              ]}
            />

            <UniformDropdown
              label="League"
              value={selectedLeague}
              onChange={setSelectedLeague}
              options={leagueOptions}
            />

            <UniformDropdown
              label="Chance"
              value={minHitRate}
              onChange={(val) => setMinHitRate(Number(val))}
              options={[
                { value: 60, label: '60%+' },
                { value: 70, label: '70%+' },
                { value: 75, label: '75%+' },
                { value: 80, label: '80%+' },
              ]}
            />

            {(selectedLeague !== 'All' || searchQuery || selectedCategory !== 'ALL' || minHitRate !== 60) && (
              <button
                onClick={() => {
                  setSelectedLeague('All');
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setMinHitRate(60);
                }}
                className="h-8 px-2.5 rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 font-semibold cursor-pointer transition-colors"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Failed to generate props analytics</div>
            <div className="text-xs text-red-600 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Verified Past Performance Table */}
      {data && data.recentEvaluations && data.recentEvaluations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Past tips</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Hit rate: {data.overallAccuracy || '—'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  The strongest tip for each of the latest matches{data.ratingsAsOf ? ` (up to ${data.ratingsAsOf})` : ''}, made before kick-off
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollapsedPropsProof(!collapsedPropsProof)}
              className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title={collapsedPropsProof ? 'Expand Proof' : 'Collapse Proof'}
            >
              <span>{collapsedPropsProof ? 'Expand' : 'Collapse'}</span>
              {collapsedPropsProof ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>

          {!collapsedPropsProof && (
            <>
              {/* Dedicated Filters for Verified Past Performance */}
              <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
                {/* Outcome Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEvalOutcomeFilter('ALL')}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      evalOutcomeFilter === 'ALL'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>All</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${evalOutcomeFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {evalCounts.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalOutcomeFilter('HITS')}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      evalOutcomeFilter === 'HITS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <span>Won</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${evalOutcomeFilter === 'HITS' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                      {evalCounts.hits}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalOutcomeFilter('MISSES')}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      evalOutcomeFilter === 'MISSES'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50/50'
                    }`}
                  >
                    <span>Lost</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${evalOutcomeFilter === 'MISSES' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'}`}>
                      {evalCounts.misses}
                    </span>
                  </button>
                </div>

                {/* Search, Category, League Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative min-w-[130px] max-w-[170px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search past tips..."
                      value={evalSearch}
                      onChange={(e) => setEvalSearch(e.target.value)}
                      className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {evalSearch && (
                      <button onClick={() => setEvalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
                    )}
                  </div>

                  <UniformDropdown
                    label="Market"
                    value={evalCategoryFilter}
                    onChange={setEvalCategoryFilter}
                    options={[
                      { value: 'ALL', label: 'All Markets' },
                      { value: 'CORNERS', label: 'Corners' },
                      { value: 'CARDS', label: 'Cards' },
                    ]}
                  />

                  <UniformDropdown
                    label="League"
                    value={evalLeagueFilter}
                    onChange={setEvalLeagueFilter}
                    options={evalLeagueOptions}
                  />

                  {(evalOutcomeFilter !== 'ALL' || evalCategoryFilter !== 'ALL' || evalLeagueFilter !== 'ALL' || evalSearch) && (
                    <button
                      onClick={() => {
                        setEvalOutcomeFilter('ALL');
                        setEvalCategoryFilter('ALL');
                        setEvalLeagueFilter('ALL');
                        setEvalSearch('');
                      }}
                      className="h-8 px-2 rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 font-semibold cursor-pointer"
                      title="Reset filters"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {filteredEvaluations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Activity className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <div className="font-semibold text-slate-700">No Audited Props Matching Current Filters</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Try "All" or clear the filters.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <MobileViewSwitcher label="Display" className="m-2" />
                  <table className="block md:table w-full text-left border-collapse text-xs">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                        <th className="py-1 px-1.5 w-7 text-center"></th>
                        <th className="py-1 px-2 w-20 text-center">Outcome</th>
                        <th className="py-1 px-2 min-w-[170px]">Fixture</th>
                        <th className="py-1 px-2 w-28 text-center">Date</th>
                        <th className="py-1 px-2 min-w-[180px]">Tip</th>
                        <th className="py-1 px-2 w-20 text-center">Fair price</th>
                        <th className="py-1 px-2 min-w-[170px]">What happened</th>
                        <th className="py-1 px-2 w-24 text-center">Our chance</th>
                      </tr>
                    </thead>
                    <tbody className="p-2.5 sm:p-0 flex flex-col md:table-row-group md:divide-y md:divide-slate-100 space-y-2.5 md:space-y-0">
                      {paginatedEvaluations.map((ev, idx) => {
                        const evalKey = ev.matchId || `${ev.home}-${ev.away}-${idx}`;
                        const isExpanded = expandedEvalId === evalKey;

                        return (
                          <React.Fragment key={evalKey}>
                            <tr 
                              className={`flex flex-col md:table-row bg-white rounded-xl md:rounded-none border border-slate-200/90 md:border-0 shadow-2xs md:shadow-none hover:border-slate-300 hover:bg-indigo-50/30 transition-all md:h-10 cursor-pointer ${
                                !ev.isHit ? 'bg-rose-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                              }`}
                              onClick={() => toggleEvalExpand(evalKey)}
                            >
                              {/* ================= MOBILE COMPACT VIEW ================= */}
                              <MobileFoldCell
                                mode={mobileViewMode}
                                expanded={isExpanded}
                                summary={
                              <FoldSummary
                                lead={ev.date ? ev.date.slice(5) : ''}
                                home={ev.home}
                                away={ev.away}
                                meta={[ev.league, ev.propPick].filter(Boolean).join(' · ')}
                                expanded={isExpanded}
                                badges={<>
                                  <FoldBadge tone={ev.isHit ? 'good' : 'bad'}>{ev.isHit ? 'Won' : 'Lost'}</FoldBadge>
                                  {Number(ev.odds) > 1 && <FoldBadge tone="neutral" mono>@{Number(ev.odds).toFixed(2)}</FoldBadge>}
                                </>}
                              />
                                }
                              >
                                <div className="flex justify-between items-start mb-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-slate-700 font-mono text-[10px]">
                                      {ev.date}
                                    </span>
                                    {ev.league && (
                                      <span className="text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
                                        {ev.league}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                                    ev.isHit ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {ev.isHit ? 'Won' : 'Lost'}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center mb-1.5">
                                  <div className="font-bold text-slate-900 text-xs">
                                    {ev.home} <span className="text-slate-400 font-normal">vs</span> {ev.away}
                                  </div>
                                  <div className="font-mono text-xs font-bold text-slate-800">
                                    {ev.odds ? `${Number(ev.odds).toFixed(2)}x` : '—'}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 mb-1">
                                  <span className="font-semibold text-slate-800 font-mono truncate max-w-[190px]">
                                    {ev.propPick}
                                  </span>
                                  <span className={`font-semibold ${ev.isHit ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                                    {ev.actualResult}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                                  <span>Chance given: <strong className="font-mono text-slate-700">{ev.hitRateRef || '—'}</strong></span>
                                  <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                                    {isExpanded ? 'Hide' : 'Details'}
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </span>
                                </div>

                                {isExpanded && (
                                  <div className={`mt-2 pt-2 border-t text-[10px] space-y-1 p-2.5 rounded ${
                                    ev.isHit ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                                  }`}>
                                    <div>Result: <strong>{ev.actualResult}</strong></div>
                                    <div>Fair price: <strong>{ev.odds}</strong></div>
                                  </div>
                                )}
                              </MobileFoldCell>

                              {/* ================= DESKTOP 1-ROW VIEW ================= */}
                              <td className="hidden md:table-cell py-1.5 px-1.5 text-center text-slate-400">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                              </td>

                              {/* Outcome Badge */}
                              <td className="hidden md:table-cell py-1.5 px-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold border ${
                                  ev.isHit 
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                  {ev.isHit ? 'Won' : 'Lost'}
                                </span>
                              </td>

                              {/* Fixture */}
                              <td className="hidden md:table-cell py-1.5 px-2">
                                <div className="font-semibold text-slate-900">{ev.home} vs {ev.away}</div>
                                {ev.league && <div className="text-[10px] text-slate-400">{ev.league}</div>}
                              </td>

                              {/* Date & Kickoff */}
                              <td className="hidden md:table-cell py-1.5 px-2 text-center whitespace-nowrap">
                                <div className="font-semibold text-slate-800 font-mono text-[11px]">{ev.date}</div>
                              </td>

                              {/* Audited Prop Line */}
                              <td className="hidden md:table-cell py-1.5 px-2">
                                <span className="font-semibold text-slate-800 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                                  {ev.propPick}
                                </span>
                              </td>

                              {/* Odds */}
                              <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono font-bold text-slate-800">
                                {ev.odds ? `${Number(ev.odds).toFixed(2)}x` : '—'}
                              </td>

                              {/* Actual Whistle Result */}
                              <td className="hidden md:table-cell py-1.5 px-2">
                                <div className={`font-semibold text-[11px] ${ev.isHit ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                                  {ev.actualResult}
                                </div>
                              </td>

                              {/* Expected Hit */}
                              <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-slate-600 font-semibold text-[11px]">
                                {ev.hitRateRef || '—'}
                              </td>
                            </tr>

                            {/* DESKTOP EXPANDED ROW */}
                            {isExpanded && (
                              <tr className={`hidden md:table-row border-b ${ev.isHit ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'}`}>
                                <td colSpan={8} className="p-3">
                                  <div className={`rounded-lg border p-2.5 flex flex-wrap items-center justify-between text-xs gap-2 ${
                                    ev.isHit ? 'bg-white border-emerald-200' : 'bg-white border-rose-200'
                                  }`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-bold ${ev.isHit ? 'text-emerald-900' : 'text-rose-900'}`}>
                                        {ev.isHit ? 'Won:' : 'Lost:'}
                                      </span>
                                      <span className="font-semibold text-slate-800">{ev.propPick}</span>
                                      <span className="text-slate-400">&bull;</span>
                                      <span className="text-slate-600">Result: <strong>{ev.actualResult}</strong></span>
                                    </div>
                                    <div className="font-mono text-xs">
                                      <span className="text-slate-500">Chance given: </span>
                                      <strong className="text-slate-800">{ev.hitRateRef || '—'}</strong>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Verified Past Performance Pagination Bar */}
              {filteredEvaluations.length > evalPageSize && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">
                    Showing <strong className="text-slate-700">{(evalPage - 1) * evalPageSize + 1}</strong> to{' '}
                    <strong className="text-slate-700">{Math.min(evalPage * evalPageSize, filteredEvaluations.length)}</strong> of{' '}
                    <strong className="text-slate-700">{filteredEvaluations.length}</strong> past tips
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEvalPage(p => Math.max(1, p - 1))}
                      disabled={evalPage === 1}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                    >
                      Previous
                    </button>
                    {Array.from({ length: evalTotalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setEvalPage(pageNum)}
                        className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                          evalPage === pageNum
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      onClick={() => setEvalPage(p => Math.min(evalTotalPages, p + 1))}
                      disabled={evalPage === evalTotalPages}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <h3 className="text-base font-bold text-slate-800">Loading tips...</h3>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredInsights.length === 0 && (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Props Matching Current Filters</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your hit rate threshold or clearing the search query to view all available matches.
          </p>
        </div>
      )}

      {/* Match Prop Analysis Header */}
      {filteredInsights.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Upcoming matches</span>
            </h2>
            <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              {filteredInsights.length} matches
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsedMatchProps(!collapsedMatchProps)}
            className="h-8 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title={collapsedMatchProps ? 'Expand Match Props' : 'Collapse Match Props'}
          >
            <span>{collapsedMatchProps ? 'Expand' : 'Collapse'}</span>
            {collapsedMatchProps ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      )}

      {/* Match Prop Analysis Table (Desktop) & Cards (Mobile) with Pagination */}
      {!collapsedMatchProps && filteredInsights.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* ================= DESKTOP TABLE VIEW ================= */}
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none h-8">
                  <th className="py-1 px-1.5 w-7 text-center"></th>
                  <th className="py-1 px-2 w-32 text-center">Kickoff</th>
                  <th className="py-1 px-2 min-w-[180px]">Match</th>
                  <th className="py-1 px-2 w-24 text-center">Corners</th>
                  <th className="py-1 px-2 w-24 text-center">Cards</th>
                  <th className="py-1 px-2 min-w-[210px]">Best tip</th>
                  <th className="py-1 px-2 w-24 text-center" title="Only bet if the bookmaker pays more than this">Fair price</th>
                  <th className="py-1 px-2 w-24 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedInsights.map((insight, idx) => {
                  const originalMatch = matches.find(m => m.id === insight.matchId) || {
                    id: insight.matchId,
                    home: insight.home,
                    away: insight.away,
                    league: insight.league,
                    date: insight.date,
                    time: insight.time,
                    timestamp: insight.timestamp,
                    utcDate: insight.utcDate,
                    dateIso: insight.dateIso
                  };

                  const isExpanded = expandedInsights.has(insight.matchId);
                  const context = insight.scrapedContext || {};
                  const structuredProps = (insight.structuredProps || []).filter(p => {
                    if (selectedCategory !== 'ALL' && p.market !== selectedCategory) return false;
                    if (p.hitProbability < minHitRate) return false;
                    return true;
                  });

                  // Primary prop pick for table row
                  const topProp = structuredProps[0] || (insight.structuredProps && insight.structuredProps[0]);
                  const topPropInSlip = topProp ? isPropInSlip(insight.matchId, topProp.label) : false;
                  const isElite = topProp?.confidenceTier === 'ELITE_ANCHOR';
                  const isHigh = topProp?.confidenceTier === 'HIGH_CONVICTION';

                  return (
                    <React.Fragment key={insight.matchId}>
                      <tr 
                        className={`hover:bg-indigo-50/30 transition-colors h-11 cursor-pointer ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                        onClick={() => toggleExpand(insight.matchId)}
                      >
                        {/* 1. Expand Chevron */}
                        <td className="py-2 px-1.5 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                        </td>

                        {/* 2. Kickoff / League */}
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="font-semibold text-slate-800 font-mono text-[11px]">
                            {formatSafeDateTime(insight, null, tzSettings).time}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {formatSafeDateTime(insight, null, tzSettings).day}, {formatSafeDateTime(insight, null, tzSettings).date}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                            {insight.league && (
                              <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-100">
                                {insight.league}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Match Fixture */}
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-900 text-xs">
                            {insight.home} <span className="text-slate-400 font-normal">vs</span> {insight.away}
                          </div>
                          {onOpenDeepResearch && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDeepResearch(originalMatch);
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5 mt-0.5"
                            >
                              Match details <ChevronRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </td>

                        {/* 4-5. What the model expects */}
                        <td className="py-2 px-2 text-center whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                          {context.totalExpectedCorners ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                          {context.totalExpectedCards ?? '—'}
                        </td>

                        {/* 6. Top Calibrated Prop */}
                        <td className="py-2 px-2">
                          {topProp ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                  isElite
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : isHigh
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {isElite ? <ShieldCheck className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                                  {topProp.hitProbability}%
                                </span>
                                <span className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider">
                                  {topProp.market}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 text-xs">
                                {topProp.label}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No prop meets &ge;{minHitRate}%</span>
                          )}
                        </td>

                        {/* 7. Fair price */}
                        <td className="py-2 px-2 text-center whitespace-nowrap font-mono font-bold text-xs text-slate-800">
                          {topProp ? topProp.fairOdds : '—'}
                        </td>

                        {/* 8. Actions */}
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          {topProp && onAddToSlip && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToSlip(
                                  originalMatch,
                                  topProp.label,
                                  `Props: ${topProp.market}`,
                                  topProp.fairOdds,
                                  topProp.hitProbability,
                                  'props-slip'
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                topPropInSlip
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                              title={topPropInSlip ? 'Remove from bet slip' : 'Add to bet slip'}
                            >
                              {topPropInSlip ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* DESKTOP EXPANDED ROW DRAWER */}
                      {isExpanded && (
                        <tr className="hidden md:table-row bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={8} className="p-4">
                            <div className="space-y-4">
                              {/* All tips */}
                              <div>
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                                    All tips for {insight.home} vs {insight.away}
                                  </span>
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    {structuredProps.length} tips
                                  </span>
                                </div>

                                {structuredProps.length === 0 ? (
                                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                                    No secondary props meet &ge;{minHitRate}% threshold.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {structuredProps.map(prop => {
                                      const inSlip = isPropInSlip(insight.matchId, prop.label);
                                      const propElite = prop.confidenceTier === 'ELITE_ANCHOR';
                                      const propHigh = prop.confidenceTier === 'HIGH_CONVICTION';

                                      return (
                                        <div
                                          key={prop.id}
                                          className={`p-3 rounded-lg border transition-all ${
                                            inSlip
                                              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300'
                                              : propElite
                                              ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                                              : 'bg-white border-slate-200 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div>
                                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 ${
                                                  propElite
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    : propHigh
                                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                }`}>
                                                  {propElite ? <ShieldCheck className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                                                  {prop.hitProbability}% likely
                                                </span>
                                                <span className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  {prop.market}
                                                </span>
                                              </div>
                                              <div className="text-xs font-bold text-slate-900 leading-snug">
                                                {prop.label}
                                              </div>
                                            </div>

                                            {onAddToSlip && (
                                              <button
                                                onClick={() => onAddToSlip(
                                                  originalMatch,
                                                  prop.label,
                                                  `Props: ${prop.market}`,
                                                  prop.fairOdds,
                                                  prop.hitProbability,
                                                  'props-slip'
                                                )}
                                                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                                  inSlip
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                }`}
                                                title={inSlip ? 'Remove from bet slip' : 'Add to bet slip'}
                                              >
                                                {inSlip ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                              </button>
                                            )}
                                          </div>

                                          <div className="flex items-center justify-between text-[10.5px] text-slate-600 pt-1.5 border-t border-slate-100">
                                            <div>
                                              Fair price: <strong className="font-mono text-slate-800">{prop.fairOdds}</strong>
                                            </div>
                                            <div className="text-slate-500">
                                              Expected: <strong className="text-slate-800">{prop.expected}</strong>
                                            </div>
                                          </div>
                                          {prop.rationale && (
                                            <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                                              {prop.rationale}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ================= MOBILE CARDS VIEW ================= */}
          <MobileViewSwitcher label="Display" className="m-2" />
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedInsights.map((insight) => {
              const originalMatch = matches.find(m => m.id === insight.matchId) || {
                id: insight.matchId,
                home: insight.home,
                away: insight.away,
                league: insight.league,
                date: insight.date,
                time: insight.time
              };

              const isExpanded = expandedInsights.has(insight.matchId);
              const context = insight.scrapedContext || {};
              const structuredProps = (insight.structuredProps || []).filter(p => {
                if (selectedCategory !== 'ALL' && p.market !== selectedCategory) return false;
                if (p.hitProbability < minHitRate) return false;
                return true;
              });

              return (
                <MobileFoldBlock
                  key={insight.matchId}
                  mode={mobileViewMode}
                  bare
                  summary={(open) => {
                    const top = structuredProps[0] || (insight.structuredProps && insight.structuredProps[0]);
                    return (
                      <FoldSummary
                        lead={compactKickoff(formatRelativeDayTime(originalMatch, tzSettings))}
                        home={insight.home}
                        away={insight.away}
                        meta={[insight.league, top?.label].filter(Boolean).join(' · ')}
                        expanded={open}
                        badges={top ? <>
                          <FoldBadge tone={top.hitProbability >= 80 ? 'good' : 'info'} mono title="Estimated hit probability">{Math.round(top.hitProbability)}%</FoldBadge>
                          {Number(top.estOdds) > 1 && <FoldBadge tone="neutral" mono>@{Number(top.estOdds).toFixed(2)}</FoldBadge>}
                        </> : null}
                      />
                    );
                  }}
                >
                  <div className="p-3 bg-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {insight.league}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatSafeDateTime(insight, null, tzSettings).time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-900">
                      {insight.home} <span className="text-slate-400 font-normal">vs</span> {insight.away}
                    </div>
                    {onOpenDeepResearch && (
                      <button
                        onClick={() => onOpenDeepResearch(originalMatch)}
                        className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5"
                      >
                        Match details <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Top prop summary */}
                  {structuredProps.length > 0 && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs mb-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{structuredProps[0].label}</span>
                        <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px]">
                          {structuredProps[0].fairOdds}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Chance: <strong className="text-emerald-700">{structuredProps[0].hitProbability}%</strong></span>
                        <span>Safety: <strong className="text-slate-700">{structuredProps[0].safetyMargin}</strong></span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => toggleExpand(insight.matchId)}
                    className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center justify-between transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Details' : `View All ${structuredProps.length} Props & AI Rationale`}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 text-xs">
                      {structuredProps.map(prop => {
                        const inSlip = isPropInSlip(insight.matchId, prop.label);
                        return (
                          <div key={prop.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 text-[11px]">{prop.label}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {prop.hitProbability}% likely &bull; fair price {prop.fairOdds}
                              </div>
                            </div>
                            {onAddToSlip && (
                              <button
                                onClick={() => onAddToSlip(
                                  originalMatch,
                                  prop.label,
                                  `Props: ${prop.market}`,
                                  prop.fairOdds,
                                  prop.hitProbability,
                                  'props-slip'
                                )}
                                className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                                  inSlip ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                                }`}
                              >
                                {inSlip ? '✓ Added' : '+ Add'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </MobileFoldBlock>
              );
            })}
          </div>

          {/* ================= PAGINATION BAR ================= */}
          {filteredInsights.length > propsPageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">
                Showing <strong className="text-slate-700">{(propsPage - 1) * propsPageSize + 1}</strong> to{' '}
                <strong className="text-slate-700">{Math.min(propsPage * propsPageSize, filteredInsights.length)}</strong> of{' '}
                <strong className="text-slate-700">{filteredInsights.length}</strong> fixtures
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPropsPage(p => Math.max(1, p - 1))}
                  disabled={propsPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                >
                  Previous
                </button>
                {Array.from({ length: propsTotalPages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setPropsPage(pageNum)}
                    className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                      propsPage === pageNum
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setPropsPage(p => Math.min(propsTotalPages, p + 1))}
                  disabled={propsPage === propsTotalPages}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Props Accumulator Modal */}

    </div>
  );
}
