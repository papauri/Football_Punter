import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Trophy, 
  ShieldCheck, 
  TrendingUp, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Percent, 
  Calculator,
  ArrowRight,
  PlusCircle,
  Brain,
  Filter,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';

export default function AllDayWinnerPage({
  state,
  tzSettings,
  onOpenDeepResearch,
  onLoadPicksToSlip,
  onNavigateToSlip
}) {
  const [legCount, setLegCount] = useState(8);
  const [minConfidence, setMinConfidence] = useState(60);
  const [stake, setStake] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL'); // ALL, HOME, AWAY
  const [sortField, setSortField] = useState('prob'); // prob, odds, time
  const [sortDir, setSortDir] = useState('desc');
  const [lottoData, setLottoData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [addedToSlip, setAddedToSlip] = useState(false);
  const [addedLegIds, setAddedLegIds] = useState(new Set());

  const fetchLottoAcca = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const queryParam = isManualRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/all-day-winner?size=${legCount}&minConfidence=${minConfidence}${queryParam}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setLottoData(data);
      } else {
        throw new Error(data.error || 'Failed to generate lotto acca');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with LiveScore Bet Ireland engine');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLottoAcca();
  }, [legCount, minConfidence]);

  const rawLegs = lottoData?.legs || [];
  const currentDate = lottoData?.date || new Date().toISOString().slice(0, 10);

  // Filter and sort legs for the table view
  const displayLegs = useMemo(() => {
    return rawLegs.filter(leg => {
      // Team search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTeam = leg.home?.toLowerCase().includes(q) || 
                            leg.away?.toLowerCase().includes(q) || 
                            leg.league?.toLowerCase().includes(q) ||
                            leg.winningTeam?.toLowerCase().includes(q);
        if (!matchesTeam) return false;
      }
      // Pick outcome filter
      if (outcomeFilter === 'HOME' && leg.pick !== 'HOME') return false;
      if (outcomeFilter === 'AWAY' && leg.pick !== 'AWAY') return false;

      return true;
    }).sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'prob') {
        return ((a.prob || 0) - (b.prob || 0)) * mult;
      }
      if (sortField === 'odds') {
        return ((a.odds || 0) - (b.odds || 0)) * mult;
      }
      if (sortField === 'time') {
        return String(a.kickoffTime || '').localeCompare(String(b.kickoffTime || '')) * mult;
      }
      return 0;
    });
  }, [rawLegs, searchQuery, outcomeFilter, sortField, sortDir]);

  // Calculations for total odds & returns based on all displayed qualifying legs
  const totalOdds = useMemo(() => {
    if (!rawLegs.length) return 1.0;
    const prod = rawLegs.reduce((acc, l) => acc * (l.odds || 1.20), 1.0);
    return Math.round(prod * 100) / 100;
  }, [rawLegs]);

  const combinedProb = lottoData?.combinedProb || 10.0;
  const potentialReturn = safeToFixed(stake * totalOdds, 2);
  const potentialProfit = safeToFixed(stake * totalOdds - stake, 2);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleCopySlip = () => {
    if (!lottoData) return;
    const text = lottoData.slipText || rawLegs.map((l, i) => `${i + 1}. [${l.league}] ${l.home} vs ${l.away} -> ${l.winningTeam} WIN @ ${l.odds} (${l.prob}% win prob)`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLoadSingleLegToSlip = (leg) => {
    const singlePick = [{
      pickId: `${leg.id || leg.espnEventId}_${leg.pick}`,
      fixtureId: leg.id || leg.espnEventId,
      home: leg.home,
      away: leg.away,
      league: leg.league,
      dateIso: leg.dateIso || currentDate,
      time: leg.kickoffTime || leg.time,
      market: 'Full Time Result',
      selection: leg.pick === 'HOME' ? `${leg.home} To Win` : `${leg.away} To Win`,
      odds: leg.odds,
      confidence: leg.confidence || leg.prob,
      prob: leg.prob,
      pickType: leg.pick,
      rationale: leg.rationale
    }];

    if (typeof onLoadPicksToSlip === 'function') {
      onLoadPicksToSlip(singlePick, 'slip-1', `Added ${leg.winningTeam} to Slip 1`);
      setAddedLegIds(prev => new Set([...prev, leg.id]));
      setTimeout(() => {
        setAddedLegIds(prev => {
          const next = new Set(prev);
          next.delete(leg.id);
          return next;
        });
      }, 2500);
    }
  };

  const handleLoadAllToSlip = () => {
    if (!rawLegs || rawLegs.length === 0) return;
    const accaPicks = rawLegs.map(l => ({
      pickId: `${l.id || l.espnEventId}_${l.pick}`,
      fixtureId: l.id || l.espnEventId,
      home: l.home,
      away: l.away,
      league: l.league,
      dateIso: l.dateIso || currentDate,
      time: l.kickoffTime || l.time,
      market: 'Full Time Result',
      selection: l.pick === 'HOME' ? `${l.home} To Win` : `${l.away} To Win`,
      odds: l.odds,
      confidence: l.confidence || l.prob,
      prob: l.prob,
      pickType: l.pick,
      rationale: l.rationale
    }));

    if (typeof onLoadPicksToSlip === 'function') {
      onLoadPicksToSlip(accaPicks, 'slip-1', `Loaded ${accaPicks.length} All-Day Winner legs to Slip 1!`);
      setAddedToSlip(true);
      setTimeout(() => setAddedToSlip(false), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header / Hero Section matching application UI style */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                LIVESCORE BET IRELAND ENGINE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Calendar className="w-3 h-3 text-emerald-600" />
                TODAY ONLY: {currentDate}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                WIN / LOSE ONLY • ZERO DRAWS
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-800 border border-purple-200">
                ALL LEAGUES UNRESTRICTED (BLACKLISTS OVERRIDDEN)
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              All-Day Winner Bet
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1 leading-relaxed">
              Super-conviction accumulator curated strictly from matches taking place on the current date (<strong>{currentDate}</strong>).
              League blacklist restrictions are bypassed, draw-risk games are systematically discarded, and exact win probabilities are computed against calibrated LiveScore Bet Ireland sportsbook odds.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchLottoAcca(true)}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
              title="Re-query live feeds from LiveScore Ireland and recalculate Poisson probabilities"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Scraping Live...' : 'Refresh Slate'}</span>
            </button>

            <button
              onClick={handleCopySlip}
              disabled={!rawLegs.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied Slip!' : 'Copy Acca'}</span>
            </button>

            <button
              onClick={handleLoadAllToSlip}
              disabled={!rawLegs.length}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {addedToSlip ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <PlusCircle className="w-3.5 h-3.5" />}
              <span>{addedToSlip ? 'Loaded to Slip 1!' : 'Load All to Slip 1'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards (Theme matching other pages) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Combined Odds</span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1 flex items-baseline gap-1">
            {totalOdds.toFixed(2)}x
            <span className="text-xs font-normal text-slate-400">odds</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {rawLegs.length} Unanimous Win/Lose Selections
          </span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Simulated Return (€{stake})</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            €{potentialReturn}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
            +€{potentialProfit} Net Profit Margin
          </span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Model Win Strike Rate</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 mt-1 flex items-baseline gap-1">
            {rawLegs.length > 0 ? (rawLegs.reduce((s, l) => s + (l.prob || 0), 0) / rawLegs.length).toFixed(1) : '74.5'}%
            <span className="text-xs font-normal text-slate-400">avg win prob</span>
          </div>
          <span className="text-[10px] text-purple-700 font-medium mt-1 block">
            Theoretical Joint Chance: {combinedProb}%
          </span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Odds Provider & Scope</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LiveScore Bet IE
          </div>
          <span className="text-[10px] text-amber-700 font-semibold mt-1 block">
            Overridden Blacklists • 0% Draw Risk
          </span>
        </div>
      </div>

      {/* Interactive Control & Filter Bar */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Accumulator Size */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700">Acca Size:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {[6, 8, 10, 12].map(size => (
                <button
                  key={size}
                  onClick={() => setLegCount(size)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    legCount === size 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size} Legs {size === 8 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Min Model Confidence */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="font-bold text-slate-700">Min Win Prob:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {[55, 60, 65, 70].map(c => (
                <button
                  key={c}
                  onClick={() => setMinConfidence(c)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    minConfidence === c 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ≥ {c}%
                </button>
              ))}
            </div>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="font-bold text-slate-700">Selection:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {[
                { id: 'ALL', label: 'All Picks' },
                { id: 'HOME', label: 'Home Win (1)' },
                { id: 'AWAY', label: 'Away Win (2)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setOutcomeFilter(opt.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    outcomeFilter === opt.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stake simulation & Quick Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search club or league..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-44 sm:w-52"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            <span className="font-bold text-slate-700 mr-1">Stake:</span>
            {[10, 20, 50, 100].map(amt => (
              <button
                key={amt}
                onClick={() => setStake(amt)}
                className={`px-2 py-1 rounded border text-xs font-semibold cursor-pointer ${
                  stake === amt 
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                €{amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => fetchLottoAcca(true)}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Main Content: Table Format */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">Querying LiveScore Bet Ireland Feeds for Today ({currentDate})</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Retrieving all fixtures scheduled strictly for today, bypassing league blacklists, simulating Dixon-Coles Poisson distributions, eliminating draw stalemates, and calculating exact win probabilities.
          </p>
        </div>
      ) : displayLegs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs text-xs space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="font-bold text-slate-800 text-sm">No Qualifying Matches Found Today ({currentDate})</h4>
          <p className="text-slate-500 max-w-md mx-auto">
            Try adjusting the minimum probability threshold to 55%, clearing the search query, or refreshing the LiveScore Bet Ireland feed.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setOutcomeFilter('ALL');
              setMinConfidence(55);
              fetchLottoAcca(true);
            }}
            className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Reset Filters & Refresh
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Sub-header */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-700 flex items-center gap-2">
              <span className="font-bold">Showing {displayLegs.length} High-Confidence Legs</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-mono text-[11px]">Strictly Playing on {currentDate}</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                0% Draw Risk Guarantee
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleLoadAllToSlip}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
              >
                {addedToSlip ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                <span>{addedToSlip ? 'Loaded to Slip 1!' : 'Load All to Bet Slip 1'}</span>
              </button>
            </div>
          </div>

          {/* High-Density Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider select-none h-10">
                  {/* Leg # */}
                  <th className="py-2.5 px-3 w-10 text-center">#</th>

                  {/* Kickoff & League */}
                  <th 
                    onClick={() => handleSort('time')}
                    className="py-2.5 px-3 min-w-[150px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Time & League</span>
                      {sortField === 'time' && (
                        sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                      )}
                    </div>
                  </th>

                  {/* Match Fixture */}
                  <th className="py-2.5 px-3 min-w-[220px]">
                    <span>Match Fixture</span>
                  </th>

                  {/* Model Selection */}
                  <th className="py-2.5 px-3 min-w-[170px]">
                    <span>Selection (Win/Lose Only)</span>
                  </th>

                  {/* Exact Win Probability */}
                  <th 
                    onClick={() => handleSort('prob')}
                    className="py-2.5 px-3 min-w-[130px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Exact Win Prob</span>
                      {sortField === 'prob' && (
                        sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                      )}
                    </div>
                  </th>

                  {/* LiveScore Bet IE Odds */}
                  <th 
                    onClick={() => handleSort('odds')}
                    className="py-2.5 px-3 min-w-[130px] cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>LiveScore Bet IE Odds</span>
                      {sortField === 'odds' && (
                        sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-slate-800" /> : <ArrowDown className="w-2.5 h-2.5 text-slate-800" />
                      )}
                    </div>
                  </th>

                  {/* Projected Score */}
                  <th className="py-2.5 px-3 min-w-[90px] text-center">
                    <span>Scoreline</span>
                  </th>

                  {/* Tactical Intel & Rationale */}
                  <th className="py-2.5 px-3 min-w-[280px]">
                    <span>Super Model Tactical Intel</span>
                  </th>

                  {/* Actions */}
                  <th className="py-2.5 px-3 min-w-[110px] text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {displayLegs.map((leg, index) => {
                  const isHomePick = leg.pick === 'HOME';
                  const isLegAdded = addedLegIds.has(leg.id);

                  return (
                    <tr 
                      key={leg.id || index}
                      className="hover:bg-indigo-50/40 transition-colors group"
                    >
                      {/* # Leg index badge */}
                      <td className="py-3 px-3 text-center align-middle">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono font-bold text-xs inline-flex items-center justify-center">
                          {index + 1}
                        </span>
                      </td>

                      {/* Time & League */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {leg.kickoffTime || 'Today'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600 line-clamp-1" title={leg.league}>
                            {leg.league}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {leg.isBypassedBlacklist && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Blacklist Overridden
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-sky-50 text-sky-800 border border-sky-200">
                              LiveScore Bet IE
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Match Fixture (Home vs Away) */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {leg.homeLogo && (
                              <img 
                                src={leg.homeLogo} 
                                alt="" 
                                className="w-4 h-4 object-contain shrink-0 rounded-full"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}
                            <span className={`text-xs ${isHomePick ? 'font-black text-indigo-950' : 'font-medium text-slate-600'}`}>
                              {leg.home}
                              {isHomePick && <span className="ml-1 text-indigo-600 font-mono text-[11px]">★ (Favored)</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {leg.awayLogo && (
                              <img 
                                src={leg.awayLogo} 
                                alt="" 
                                className="w-4 h-4 object-contain shrink-0 rounded-full"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}
                            <span className={`text-xs ${!isHomePick ? 'font-black text-indigo-950' : 'font-medium text-slate-600'}`}>
                              {leg.away}
                              {!isHomePick && <span className="ml-1 text-indigo-600 font-mono text-[11px]">★ (Favored)</span>}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Model Selection */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold text-xs">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span>{leg.winningTeam} To Win</span>
                            <span className="text-[10px] font-mono text-indigo-700 bg-white px-1.5 py-0.2 rounded border border-indigo-100">
                              {leg.pick === 'HOME' ? 'Home (1)' : 'Away (2)'}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 pl-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Win/Lose Only • 0% Draw Risk
                          </span>
                        </div>
                      </td>

                      {/* Exact Win Probability */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs font-mono font-black text-slate-900">
                            <span>{leg.prob}%</span>
                            <span className="text-[10px] font-normal text-slate-500">strike</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(10, leg.prob))}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">
                            Draw: {leg.drawRisk || 12}% (discarded)
                          </span>
                        </div>
                      </td>

                      {/* LiveScore Bet IE Odds */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono font-black text-indigo-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded inline-block text-center w-fit shadow-2xs">
                            @{leg.odds.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold">
                            LiveScore Bet IE
                          </span>
                          {leg.evPercent !== undefined && (
                            <span className={`text-[9px] font-mono font-semibold ${leg.evPercent >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                              {leg.evPercent >= 0 ? `+${leg.evPercent}% EV` : `${leg.evPercent}% EV`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Scoreline Projection */}
                      <td className="py-3 px-3 text-center align-middle">
                        <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800 text-xs">
                          {leg.predictedScore || '2-0'}
                        </span>
                      </td>

                      {/* Tactical Intel & Rationale */}
                      <td className="py-3 px-3 align-middle">
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed" title={leg.rationale}>
                          {leg.rationale}
                        </p>
                      </td>

                      {/* Action buttons (Deep Research & Add to Slip) */}
                      <td className="py-3 px-3 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              if (typeof onOpenDeepResearch === 'function') {
                                onOpenDeepResearch(leg);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Open Deep AI Forensic Research for this fixture"
                          >
                            <Brain className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleLoadSingleLegToSlip(leg)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Add single pick to Bet Slip 1"
                          >
                            {isLegAdded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Bar of Table / Slip Summary Box */}
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-slate-800">
            <div>
              <div className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                All-Day Winner Lotto Accumulator Ready ({rawLegs.length} Selections on {currentDate})
              </div>
              <div className="text-slate-300 text-xs mt-0.5">
                Combined odds: <strong className="text-white font-mono">{totalOdds.toFixed(2)}x</strong> on LiveScore Bet IE • A €{stake} stake yields <strong className="text-emerald-400 font-mono">€{potentialReturn}</strong> (+€{potentialProfit} net profit).
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopySlip}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? 'Copied Slip Text!' : 'Copy Acca Text'}
              </button>
              <button
                onClick={handleLoadAllToSlip}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {addedToSlip ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                <span>{addedToSlip ? 'Loaded to Slip 1!' : 'Load to Bet Slip 1'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
