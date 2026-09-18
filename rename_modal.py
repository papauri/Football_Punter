import re
with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

# Replace function YesterdayProofModal({ ... }) with function ProofModal({ ... })
text = re.sub(
    r"function YesterdayProofModal\(\{.*?\}\) \{",
    """function ProofModal({
  isOpen,
  title,
  stats,
  matchesList = [],
  postMortems = [],
  onClose,
  onAnalyzeMatch,
  onNavigateToResults,
  isToday
}) {""",
    text,
    flags=re.DOTALL
)

# Replace internal references to yesterdayStats with stats and yesterdayMatches with matchesList
text = text.replace("yesterdayMatches", "matchesList")
text = text.replace("yesterdayStats", "stats")

# Replace hardcoded title
text = text.replace(
    "Yesterday's Prediction Accuracy &amp; Settlement Proof",
    "{title}"
)

# And add the AI Post-Mortem insight tab!
# Find the filter controls bar
filter_bar_pattern = re.compile(r'\{/\* Filter Controls Bar \*/\}.*?</select>\s*</div>\s*</div>', re.DOTALL)

filter_bar_replacement = """{/* Filter Controls Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
            <button 
              onClick={() => setFilterMode('ALL')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${filterMode === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              All Matches
            </button>
            <button 
              onClick={() => setFilterMode('HITS')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterMode === 'HITS' ? 'bg-emerald-900/60 text-emerald-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Hits
            </button>
            <button 
              onClick={() => setFilterMode('MISSES')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterMode === 'MISSES' ? 'bg-rose-900/60 text-rose-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <XCircle className="w-3.5 h-3.5" /> Misses
            </button>
            <button 
              onClick={() => setFilterMode('POSTMORTEMS')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterMode === 'POSTMORTEMS' ? 'bg-amber-900/60 text-amber-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <Cpu className="w-3.5 h-3.5" /> AI Analysis
            </button>
          </div>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search teams or leagues..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-600"
              />
            </div>
            <select 
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-600 max-w-[120px] sm:max-w-none"
            >
              <option value="ALL">All Leagues</option>
              {leagues.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>"""

text = filter_bar_pattern.sub(filter_bar_replacement, text)

# Add the PostMortems view rendering
matches_list_render_pattern = re.compile(r'\{/\* Matches List \*/\}.*?</div>\s*</div>\s*</div>\s*\);\s*\}', re.DOTALL)

original_matches_list_match = matches_list_render_pattern.search(text)
original_matches_list = original_matches_list_match.group(0)

# Replace the original matches list with a conditional
new_matches_list = """{/* Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950">
          {filterMode === 'POSTMORTEMS' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 bg-amber-900/40 rounded-lg text-amber-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300 mb-1">AI Post-Mortem Analytics</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This is the engine's cognitive reflection log. When a highly confident prediction fails, 
                      the agent automatically fetches the latest match reports, tactical analytics, and injury news to understand 
                      <strong>why</strong> the Poisson distribution failed, and applies these learnings to parameter weights going forward.
                    </p>
                  </div>
                </div>
              </div>

              {postMortems.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                  <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-300">No AI reflections available yet.</p>
                  <p className="text-xs text-slate-500 mt-1">The agent will run a reflection cycle automatically when high-confidence predictions miss.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {postMortems.map((pm, idx) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                      <div className="p-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{pm.homeTeam} vs {pm.awayTeam}</span>
                          <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-950 rounded">{pm.league}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(pm.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1 space-y-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Model Pick</p>
                            <p className="text-xs font-medium text-slate-300">{pm.predictedWinner} <span className="text-slate-500">({pm.projectedScore})</span></p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Actual Result</p>
                            <p className="text-xs font-bold text-rose-400">{pm.actualWinner} <span className="text-rose-500/70">({pm.actualScore})</span></p>
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-[10px] text-amber-500/80 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> Tactical Diagnosis
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                            {pm.aiDiagnosis}
                          </p>
                          <div className="mt-3 flex gap-2 flex-wrap">
                            {pm.adjustments.homeAttack !== 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                HM-Atk: <span className={pm.adjustments.homeAttack > 0 ? 'text-emerald-400' : 'text-rose-400'}>{pm.adjustments.homeAttack > 0 ? '+' : ''}{pm.adjustments.homeAttack}</span>
                              </span>
                            )}
                            {pm.adjustments.awayAttack !== 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                AW-Atk: <span className={pm.adjustments.awayAttack > 0 ? 'text-emerald-400' : 'text-rose-400'}>{pm.adjustments.awayAttack > 0 ? '+' : ''}{pm.adjustments.awayAttack}</span>
                              </span>
                            )}
                            {pm.adjustments.rho !== 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                Volatility ρ: <span className={pm.adjustments.rho > 0 ? 'text-emerald-400' : 'text-rose-400'}>{pm.adjustments.rho > 0 ? '+' : ''}{pm.adjustments.rho}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
""" + original_matches_list_match.group(0).replace("{/* Matches List */}", "") + """
          </>
          )}
        </div>
      </div>
    </div>
  );
}"""

text = text.replace(original_matches_list, new_matches_list)

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)

