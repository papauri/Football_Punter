import re

with open('src/components/ScoresTablePage.jsx', 'r') as f:
    content = f.read()

pattern = r'\{/\* Top Bar with Accuracy Summary \*/\}.*?\{/\* Matches Table \*/\}'

new_header = '''{/* Top Banner & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Goals &amp; Totals Predictions</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                {filteredMatches.length} Fixtures
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Top projected scorelines, Over/Under 1.5/2.5 probabilities, and BTTS market insights.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aggregateStats ? (
              <>
                <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Exp. Exact Score</div>
                  <div className="font-bold text-slate-800 font-mono text-sm">{aggregateStats.exactScore}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Exp. O/U 2.5</div>
                  <div className="font-bold text-emerald-700 font-mono text-sm">{aggregateStats.over25}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Exp. BTTS</div>
                  <div className="font-bold text-indigo-700 font-mono text-sm">{aggregateStats.btts}%</div>
                </div>
              </>
            ) : (
              <div className="text-slate-400 text-xs italic">No matches found</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search club or competition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
          </div>
          
          {/* Right: Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <UniformDropdown
              label="Date"
              value={selectedDate}
              onChange={setSelectedDate}
              options={dateOptions}
            />
            <UniformDropdown
              label="League"
              value={selectedLeague}
              onChange={setSelectedLeague}
              options={leagueOptions}
            />
            <UniformDropdown
              label="Market View"
              value={filterMode}
              onChange={setFilterMode}
              options={[
                { value: 'All', label: 'All Predictions' },
                { value: 'OVER25_ONLY', label: 'Over 2.5 Goals (>60%)' },
                { value: 'UNDER25_ONLY', label: 'Under 2.5 Goals (>60%)' },
                { value: 'BTTS_YES', label: 'BTTS Yes (>60%)' },
                { value: 'BTTS_NO', label: 'BTTS No (>60%)' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Showing matches count */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <span>Showing <strong>{filteredMatches.length}</strong> of {matches.length} fixtures</span>
        {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || filterMode !== 'All') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedLeague('All');
              setSelectedDate('All');
              setFilterMode('All');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Matches Table */}'''

content = re.sub(pattern, new_header, content, flags=re.DOTALL)

with open('src/components/ScoresTablePage.jsx', 'w') as f:
    f.write(content)

