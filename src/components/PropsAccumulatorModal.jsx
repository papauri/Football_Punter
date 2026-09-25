import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  TrendingUp, 
  X, 
  RefreshCw, 
  Zap, 
  Flame, 
  Award,
  Wallet,
  Clock,
  ArrowRight,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatRelativeDayTime } from '../utils/dateUtils';
import { safeToFixed, safeParseFloat } from '../utils/numberUtils';

export default function PropsAccumulatorModal({
  isOpen,
  onClose,
  initialSlip = null,
  onAddToBetSlip,
  matches = [],
  onViewPropsSlip,
  tzSettings
}) {
  const [slip, setSlip] = useState(initialSlip);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stake, setStake] = useState(25);
  const [legsCount, setLegsCount] = useState(3);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    if (initialSlip) {
      setSlip(initialSlip);
    } else if (isOpen) {
      fetchAccumulator(3);
    }
  }, [initialSlip, isOpen]);

  const fetchAccumulator = async (legs = 3, force = true) => {
    setLoading(true);
    setAddedNotice(false);
    try {
      const res = await fetch('/api/props-accumulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          legs, 
          forceRefresh: force,
          matches: matches.length > 0 ? matches.slice(0, 15) : undefined
        })
      });
      const data = await res.json();
      if (data.success && data.result?.slip) {
        setSlip(data.result.slip);
      }
    } catch (err) {
      console.error('Failed to fetch props accumulator:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySlip = () => {
    if (!slip) return;
    const textToCopy = slip.copyableText || slip.legs.map((l, i) => `${i + 1}. ${l.fixture} - ${l.pick} @ ${l.odds}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddAllToSlip = () => {
    if (!slip || !onAddToBetSlip) return;
    slip.legs.forEach(leg => {
      onAddToBetSlip(
        { id: leg.matchId, home: leg.home, away: leg.away, league: leg.league },
        leg.pick,
        `Props: ${leg.market}`,
        leg.odds,
        leg.hitProbability,
        'props-slip'
      );
    });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 4000);
  };

  if (!isOpen) return null;

  const combinedOdds = safeParseFloat(slip?.combinedOdds, 2.0);
  const potentialPayout = safeToFixed(stake * combinedOdds, 2);
  const netProfit = safeToFixed(stake * combinedOdds - stake, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  LiveScore Bet Props Acca
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Anti-Fragile
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-match Poisson anchor parlay optimized for LiveScore Bet Ireland
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchAccumulator(legsCount, true)}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Regenerate optimal slip"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">
          
          {/* Quick Metrics Strip */}
          {slip && (
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">LiveScore Bet Odds</div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
                  {slip.combinedOdds}x
                </div>
                <div className="text-[10px] text-indigo-600 font-bold mt-0.5">Combined Price</div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Joint Hit Prob</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">
                  {slip.jointProbability}%
                </div>
                <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Avg Leg: {slip.avgLegHitRate}%</div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider">Expected Value</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono mt-0.5">
                  +{slip.expectedValue}%
                </div>
                <div className="text-[10px] text-indigo-600 font-bold mt-0.5">EV+ Advantage</div>
              </div>
            </div>
          )}

          {/* Leg Count Filter Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-slate-700">Accumulator Size:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              {[2, 3, 4].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    setLegsCount(count);
                    fetchAccumulator(count, true);
                  }}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    legsCount === count 
                      ? 'bg-white text-indigo-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {count} Legs
                </button>
              ))}
            </div>
          </div>

          {/* Props Legs Cards */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Selected Anchor Legs ({slip?.legs?.length || 0})</span>
              <span className="text-[11px] text-emerald-700 font-medium font-mono">Cross-Match Independent</span>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                <div className="text-xs text-slate-600 font-medium">Scanning live Poisson matrix & pricing against LiveScore Bet IE...</div>
              </div>
            ) : !slip || slip.legs.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                No active fixtures found with sufficient anchor props. Check back as upcoming slates populate.
              </div>
            ) : (
              slip.legs.map((leg, idx) => (
                <div 
                  key={leg.matchId || idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center font-mono shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {leg.fixture}
                      </span>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                        {leg.league}
                      </span>
                      {(leg.kickoff || leg.date || leg.time) && (
                        <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatRelativeDayTime(leg.date || leg.kickoff || leg.time, tzSettings)}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        ~{leg.odds}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {leg.pick}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        {leg.market}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" /> {leg.hitProbability}% Hit Rate
                      </span>
                      {leg.evPercent > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                          +{leg.evPercent}% EV
                        </span>
                      )}
                    </div>
                  </div>

                  {leg.rationale && (
                    <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{leg.rationale}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* AI Correlation & Anti-Fragility Critique */}
          {slip?.aiCritique && (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Risk Assessment (LiveScore Bet Ireland)</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed space-y-1.5">
                <ReactMarkdown>{slip.aiCritique}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Stake & Return Quick Calculator */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                <span>Quick Stake Calculator</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setStake(val)}
                    className={`px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                      stake === val 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    €{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-xs">
              <span className="text-slate-600 font-medium">Potential Payout ({combinedOdds}x):</span>
              <span className="text-base font-extrabold text-emerald-700 font-mono">
                €{potentialPayout} <span className="text-xs text-emerald-600 font-medium font-sans">(+€{netProfit} profit)</span>
              </span>
            </div>
          </div>

          {addedNotice && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center justify-between gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All {slip?.legs?.length || 3} legs added to dedicated Props Slip!</span>
              </div>
              {onViewPropsSlip && (
                <button
                  type="button"
                  onClick={onViewPropsSlip}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  View Props Slip &rarr;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Quick Betting Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleAddAllToSlip}
            className="w-full sm:w-auto h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Load into Props Slip ({slip?.legs?.length || 0})</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopySlip}
              className={`flex-1 sm:flex-none h-8 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                copied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied for LiveScore Bet!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Bet Slip</span>
                </>
              )}
            </button>

            <a
              href="https://www.livescorebet.com/ie/sports/football"
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-black text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs shrink-0"
              title="Open LiveScore Bet Ireland sportsbook"
            >
              <span>Bet on LiveScore Bet</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
