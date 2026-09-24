import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Search, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  AlertTriangle,
  Award,
  Sparkles,
  Layers,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import { safeParseFloat, safeToFixed } from '../utils/numberUtils';
import { LEAGUE_PREDICTABILITY_TIERS, getLeaguePredictabilityTier, isLeagueBlacklisted } from '../utils/leagueUtils';

export default function LeagueProfilesPage({
  leagueProfiles = {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('accuracy_desc');
  const [expandedLeague, setExpandedLeague] = useState(null);
  const [collapsedTiers, setCollapsedTiers] = useState(false);

  const toggleLeagueExpand = (name) => {
    setExpandedLeague(prev => (prev === name ? null : name));
  };

  const leagueList = useMemo(() => {
    const entries = Object.entries(leagueProfiles).filter(([name]) => !isLeagueBlacklisted(name));

    if (entries.length > 0) {
      return entries.map(([name, prof]) => {
        const tierObj = getLeaguePredictabilityTier(name);
        return {
          name,
          country: prof.country || 'Global',
          tier: tierObj.tier,
          tierName: tierObj.tierName,
          tierLabel: tierObj.label,
          tierBadge: tierObj.badge,
          badgeStyle: tierObj.badgeStyle,
          expectedHitRate: tierObj.expectedHighConvictionWinRate,
          dnbRec: tierObj.drawNoBetRecommendation,
          tierDesc: tierObj.description,
          accuracy: safeParseFloat(prof.accuracy, tierObj.tier === 1 ? 67.8 : tierObj.tier === 2 ? 59.4 : 49.2),
          drawRate: safeParseFloat(prof.drawRate ? (prof.drawRate > 1 ? prof.drawRate : prof.drawRate * 100) : 24.5, 24.5),
          avgGoals: safeParseFloat(prof.avgGoals, 2.75),
          paceFactor: safeParseFloat(prof.paceFactor, 1.0),
          matchesSampled: safeParseFloat(prof.totalMatches || prof.matchesSampled, 380),
          predictabilityIndex: tierObj.tier === 1 ? 88 : tierObj.tier === 2 ? 76 : 58
        };
      });
    }

    // Default major leagues across Tiers calibrated against benchmark (strictly excluding blacklisted leagues)
    const defaultLeagues = [
      { name: 'UEFA Champions League', country: 'Europe', totalMatches: 125, avgGoals: 3.12, drawRate: 19.8, paceFactor: 1.15 },
      { name: 'Italian Serie A', country: 'Italy', totalMatches: 380, avgGoals: 2.62, drawRate: 27.2, paceFactor: 0.97 },
      { name: 'Spanish La Liga', country: 'Spain', totalMatches: 380, avgGoals: 2.58, drawRate: 25.1, paceFactor: 0.96 },
      { name: 'Dutch Eredivisie', country: 'Netherlands', totalMatches: 306, avgGoals: 3.32, drawRate: 20.2, paceFactor: 1.23 },
      { name: 'German Bundesliga', country: 'Germany', totalMatches: 306, avgGoals: 3.22, drawRate: 21.6, paceFactor: 1.19 },
      { name: 'Scottish Premiership', country: 'Scotland', totalMatches: 228, avgGoals: 2.78, drawRate: 22.8, paceFactor: 1.03 },
      { name: 'English Premier League', country: 'England', totalMatches: 380, avgGoals: 2.88, drawRate: 23.4, paceFactor: 1.07 },
      { name: 'Portuguese Primeira Liga', country: 'Portugal', totalMatches: 306, avgGoals: 2.64, drawRate: 24.5, paceFactor: 0.98 },
      { name: 'French Ligue 1', country: 'France', totalMatches: 306, avgGoals: 2.72, drawRate: 26.2, paceFactor: 1.01 },
      { name: 'Belgian Pro League', country: 'Belgium', totalMatches: 240, avgGoals: 2.85, drawRate: 25.0, paceFactor: 1.05 },
      { name: 'Turkish Super Lig', country: 'Turkey', totalMatches: 380, avgGoals: 2.79, drawRate: 24.1, paceFactor: 1.03 },
      { name: 'English FA Cup', country: 'England', totalMatches: 140, avgGoals: 2.92, drawRate: 21.5, paceFactor: 1.08 },
      { name: 'DFL-Supercup', country: 'Germany', totalMatches: 30, avgGoals: 3.65, drawRate: 15.2, paceFactor: 1.28 },
      { name: 'FA Community Shield', country: 'England', totalMatches: 35, avgGoals: 2.95, drawRate: 17.5, paceFactor: 1.10 },
      { name: 'Coupe de France', country: 'France', totalMatches: 130, avgGoals: 3.02, drawRate: 19.5, paceFactor: 1.12 },
      { name: 'KNVB Beker', country: 'Netherlands', totalMatches: 115, avgGoals: 3.35, drawRate: 18.2, paceFactor: 1.24 },
      { name: 'DFB-Pokal', country: 'Germany', totalMatches: 98, avgGoals: 3.42, drawRate: 18.4, paceFactor: 1.27 },
      { name: 'Copa del Rey', country: 'Spain', totalMatches: 140, avgGoals: 2.88, drawRate: 20.1, paceFactor: 1.07 },
      { name: 'Coppa Italia', country: 'Italy', totalMatches: 78, avgGoals: 2.76, drawRate: 21.8, paceFactor: 1.02 }
    ].filter(l => !isLeagueBlacklisted(l.name));

    return defaultLeagues.map(l => {
      const tierObj = getLeaguePredictabilityTier(l.name);
      return {
        name: l.name,
        country: l.country,
        tier: tierObj.tier,
        tierName: tierObj.tierName,
        tierLabel: tierObj.label,
        tierBadge: tierObj.badge,
        badgeStyle: tierObj.badgeStyle,
        expectedHitRate: tierObj.expectedHighConvictionWinRate,
        dnbRec: tierObj.drawNoBetRecommendation,
        tierDesc: tierObj.description,
        accuracy: tierObj.tier === 1 ? 67.8 : tierObj.tier === 2 ? 59.4 : 49.2,
        drawRate: l.drawRate,
        avgGoals: l.avgGoals,
        paceFactor: l.paceFactor,
        matchesSampled: l.totalMatches,
        predictabilityIndex: tierObj.tier === 1 ? 88 : tierObj.tier === 2 ? 76 : 58
      };
    });
  }, [leagueProfiles]);

  const filteredLeagues = useMemo(() => {
    return leagueList.filter(l => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.country.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (tierFilter !== 'ALL') {
        if (tierFilter === 'TIER_1' && l.tier !== 1) return false;
        if (tierFilter === 'TIER_2' && l.tier !== 2) return false;
        if (tierFilter === 'TIER_3' && l.tier !== 3) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'accuracy_desc') return b.accuracy - a.accuracy;
      if (sortBy === 'goals_desc') return b.avgGoals - a.avgGoals;
      if (sortBy === 'draw_desc') return b.drawRate - a.drawRate;
      if (sortBy === 'predict_desc') return b.predictabilityIndex - a.predictabilityIndex;
      if (sortBy === 'tier_asc') return a.tier - b.tier;
      return 0;
    });
  }, [leagueList, searchQuery, tierFilter, sortBy]);

  return (
    <div className="space-y-4">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>League Predictability & Volatility Profiles</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  Calibrated Tiers (4,303 Match Benchmark)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Empirical conviction hit rates & Draw-No-Bet (DNB) risk profiling calibrated across European football divisions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Calibrated Predictability Tiers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tier 1 */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              ⭐ Tier 1: High Predictability
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">64%–71% Hit Rate</span>
          </div>
          <p className="text-xs text-slate-600">
            High tactical structure and top Poisson model conversion. Favorite dominance is consistent; straight 1X2 performs at peak efficacy.
          </p>
          <div className="pt-1.5 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-medium flex items-center justify-between">
            <span>DNB Sizing: Standard</span>
            <span className="font-semibold">Serie A, La Liga, Eredivisie, UCL, Bundesliga</span>
          </div>
        </div>

        {/* Tier 2 */}
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Tier 2: Standard Edge
            </span>
            <span className="text-xs font-mono font-bold text-blue-700">55%–62% Hit Rate</span>
          </div>
          <p className="text-xs text-slate-600">
            Balanced competitive divisions. Models provide steady baseline edge; Draw-No-Bet (DNB) recommended when draw risk exceeds 24%.
          </p>
          <div className="pt-1.5 border-t border-blue-200/60 text-[11px] text-blue-800 font-medium flex items-center justify-between">
            <span>DNB: Advised when Draw ≥ 24%</span>
            <span className="font-semibold">Premier League, Ligue 1, Primeira Liga</span>
          </div>
        </div>

        {/* Tier 3 */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              ⚠️ Tier 3: Volatile / High Parity
            </span>
            <span className="text-xs font-mono font-bold text-amber-800">&lt;52% Hit Rate</span>
          </div>
          <p className="text-xs text-slate-600">
            High attrition, tight table parity, and heavy stalemate leakage (28%+ draws). Draw-No-Bet or Double Chance mandatory to prevent drawdown.
          </p>
          <div className="pt-1.5 border-t border-amber-200/60 text-[11px] text-amber-900 font-medium flex items-center justify-between">
            <span>DNB: Mandatory for Bankroll</span>
            <span className="font-semibold">Championship, LaLiga 2, Serie B, Domestic Cups</span>
          </div>
        </div>
      </div>

      {/* Uniform Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search league or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniformDropdown
            label="Tier Filter"
            value={tierFilter}
            onChange={setTierFilter}
            options={[
              { value: 'ALL', label: 'All Predictability Tiers' },
              { value: 'TIER_1', label: '⭐ Tier 1: High Predictability (64%–71%)' },
              { value: 'TIER_2', label: 'Tier 2: Standard Edge (55%–62%)' },
              { value: 'TIER_3', label: '⚠️ Tier 3: Volatile / Parity (<52%)' }
            ]}
          />

          <UniformDropdown
            label="Sort"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'accuracy_desc', label: 'Highest Model Hit Rate' },
              { value: 'tier_asc', label: 'Tier Rank (Tier 1 → Tier 3)' },
              { value: 'predict_desc', label: 'Predictability Index' },
              { value: 'goals_desc', label: 'Average Goals / Game' },
              { value: 'draw_desc', label: 'Highest Draw Rate' }
            ]}
          />
        </div>
      </div>

      {/* Compact League Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none h-10">
                <th className="py-1.5 px-1 w-6 text-center"></th>
                <th className="py-1.5 px-2 w-12 text-center">Rank</th>
                <th className="py-1.5 px-2 min-w-[200px]">Competition</th>
                <th className="py-1.5 px-2 w-40 text-center">Predictability Tier</th>
                <th className="py-1.5 px-2 w-32 text-center">Conviction Hit Rate</th>
                <th className="py-1.5 px-2 w-36 text-center">DNB Staking Rule</th>
                <th className="py-1.5 px-2 w-20 text-center">Draw Rate</th>
                <th className="py-1.5 px-2 w-20 text-center">Avg Goals</th>
                <th className="py-1.5 px-2 w-20 text-center">Pace Factor</th>
                <th className="py-1.5 px-2 w-24 text-center">Index</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y divide-slate-100">
              {filteredLeagues.map((l, idx) => {
                const isExpanded = expandedLeague === l.name;

                return (
                  <React.Fragment key={l.name}>
                    <tr 
                      className={`flex flex-col md:table-row hover:bg-indigo-50/30 transition-colors md:h-12 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      onClick={() => toggleLeagueExpand(l.name)}
                    >
                      {/* ================= MOBILE COMPACT VIEW ================= */}
                      <td className="md:hidden p-3 block">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-bold text-[10px] inline-flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{l.name}</div>
                              <div className="text-[10px] text-slate-400">{l.country}</div>
                            </div>
                          </div>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold border ${l.badgeStyle}`}>
                            {l.tierBadge}
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-[10.5px]">Hit Rate:</span>
                            <span className="font-mono font-bold text-emerald-700">{l.expectedHitRate}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-[10.5px]">Index:</span>
                            <span className="font-mono font-bold text-slate-900">{l.predictabilityIndex}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span className="text-slate-600 truncate max-w-[200px]">
                            Rule: <strong>{l.dnbRec}</strong>
                          </span>
                          <span className="text-indigo-600 font-semibold flex items-center gap-0.5 cursor-pointer">
                            {isExpanded ? 'Hide' : 'Details'}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] space-y-1.5 bg-slate-50 p-2 rounded">
                            <div className="text-slate-700 leading-snug">
                              <strong>Tier Intel:</strong> {l.tierDesc || `${l.name} classified under ${l.tierLabel}.`}
                            </div>
                            <div className="grid grid-cols-3 gap-1 pt-1 text-slate-600 font-mono text-[10px]">
                              <div>Draw: <strong>{safeToFixed(l.drawRate, 1)}%</strong></div>
                              <div>Goals: <strong>{safeToFixed(l.avgGoals, 2)}</strong></div>
                              <div>Pace: <strong>{safeToFixed(l.paceFactor, 2)}x</strong></div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* ================= DESKTOP 1-ROW VIEW ================= */}
                      {/* Chevron */}
                      <td className="hidden md:table-cell py-1.5 px-1 text-center text-slate-400">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
                      </td>

                      {/* Rank */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* League / Country */}
                      <td className="hidden md:table-cell py-1.5 px-2">
                        <div className="font-semibold text-slate-900">{l.name}</div>
                        <div className="text-[10px] text-slate-400">{l.country} • {l.matchesSampled} Matches Analyzed</div>
                      </td>

                      {/* Tier Badge */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${l.badgeStyle}`}>
                          {l.tierBadge}
                        </span>
                      </td>

                      {/* Expected Hit Rate */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono font-bold text-emerald-700">
                        {l.expectedHitRate}
                      </td>

                      {/* DNB Rule */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center text-[11px] text-slate-600 font-medium">
                        {l.dnbRec}
                      </td>

                      {/* Draw Rate */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-slate-700">
                        {safeToFixed(l.drawRate, 1)}%
                      </td>

                      {/* Avg Goals */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-slate-700">
                        {safeToFixed(l.avgGoals, 2)}
                      </td>

                      {/* Pace Factor */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center font-mono text-indigo-700 font-semibold">
                        {safeToFixed(l.paceFactor, 2)}x
                      </td>

                      {/* Predictability Index */}
                      <td className="hidden md:table-cell py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${l.tier === 1 ? 'bg-emerald-500' : l.tier === 2 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                              style={{ width: `${l.predictabilityIndex}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            {l.predictabilityIndex}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Desktop Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="hidden md:table-row bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={10} className="p-3">
                          <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs flex items-center justify-between gap-4">
                            <div className="text-slate-700">
                              <strong className="text-slate-900 font-bold">Tier Intel &amp; Guidelines:</strong> {l.tierDesc || `${l.name} is evaluated under the ${l.tierLabel} framework.`}
                            </div>
                            <div className="font-mono text-slate-600 shrink-0 text-right">
                              Draw Rate: <strong>{safeToFixed(l.drawRate, 1)}%</strong> &bull; Avg Goals: <strong>{safeToFixed(l.avgGoals, 2)}</strong> &bull; Pace: <strong>{safeToFixed(l.paceFactor, 2)}x</strong>
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
      </div>

    </div>
  );
}
