import re

with open('src/components/FixturesTablePage.jsx', 'r') as f:
    content = f.read()

# Pattern to replace the top section of FixturesTablePage
pattern = r'\{/\* Top Filter & Toolbar Bar \*/\}.*?\{/\* Action Buttons Row \*/\}'

new_header = '''{/* Top Banner & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Main Model & Match Outputs (1X2)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {matches.length} Matches Analyzed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive probability engine combining Dixon-Coles, Elo, and 6-Agent Consensus.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRetrainModel && onRetrainModel()}
              disabled={isRetraining}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              <Cpu className={`w-3.5 h-3.5 text-indigo-600 ${isRetraining ? 'animate-spin' : ''}`} />
              <span>{isRetraining ? 'Retraining...' : 'Retrain Statistical Model'}</span>
            </button>
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
              label="Conviction"
              value={filterMode}
              onChange={setFilterMode}
              options={[
                { value: 'All', label: 'All Convictions' },
                { value: 'UNANIMOUS', label: '👑 6-Agent Unanimous' },
                { value: 'NO_TRAPS', label: '🛡️ High Stability Only' },
                { value: 'DERIVATIVE_SAFETY', label: '🔄 Smart Derivative Picks' },
                { value: 'ELITE', label: 'Elite Edge (≥75%)' },
                { value: 'HIGH_CONFIDENCE', label: 'High Conf (≥65%)' }
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

      {/* Remove old action row & chips */}
      {/* Action Buttons Row */}'''

content = re.sub(pattern, new_header, content, flags=re.DOTALL)

# Remove the rest of the old quick chips
pattern2 = r'\{/\* Quick Strategy Filter Chips \*/\}.*?\{/\* Matches Table \*/\}'
content = re.sub(pattern2, '{/* Matches Table */}', content, flags=re.DOTALL)

with open('src/components/FixturesTablePage.jsx', 'w') as f:
    f.write(content)

