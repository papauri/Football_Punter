import re

with open('src/components/LineupsPage.jsx', 'r') as f:
    content = f.read()

pattern = r'\{/\* Top Navigation & Match Selector Bar \*/\}.*?\{/\* Model Probabilities Before vs After Lineup \*/\}'

new_header = '''{/* Top Banner & Match Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-fixtures-btn"
              onClick={onBackToFixtures}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Tactical Lineup Analysis</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  isOfficial 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {isOfficial ? 'Official Confirmed Lineup' : 'Projected XI'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time starting XI scrape and engine probability recalibration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-lineup-btn"
              onClick={() => fetchLineup(true)}
              disabled={isRefreshing || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isRefreshing ? 'Scraping...' : 'Re-scrape XI'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline shrink-0">
              Select Match:
            </span>
            <UniformDropdown
              value={activeMatch ? (activeMatch.id || String(matches.indexOf(activeMatch))) : ''}
              onChange={handleMatchChange}
              options={matchOptions}
              className="w-full max-w-md"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium whitespace-nowrap">
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="text-indigo-700 font-bold">{homeFormation}</span> vs <span className="text-indigo-700 font-bold">{awayFormation}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              Starters: <strong className="text-slate-900">{homeLineup.length} / {awayLineup.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Fixture Probabilities Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {activeMatch?.league || lineupData?.league || 'League Match'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {(activeMatch?.timestamp || activeMatch?.utcDate || activeMatch?.dateIso || activeMatch?.date) 
                  ? formatRelativeDayTime(activeMatch.timestamp || activeMatch.utcDate || activeMatch.dateIso || activeMatch.date, tzSettings) 
                  : (activeMatch?.time || 'Upcoming')}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>{home}</span>
              <span className="text-slate-400 font-normal text-sm">vs</span>
              <span>{away}</span>
            </h2>
          </div>

          {/* Model Probabilities Before vs After Lineup */}'''

content = re.sub(pattern, new_header, content, flags=re.DOTALL)

with open('src/components/LineupsPage.jsx', 'w') as f:
    f.write(content)

