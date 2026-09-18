import re

with open('src/components/BinaryPicksPage.jsx', 'r') as f:
    content = f.read()

pattern = r'\{/\* Top Filter & Toolbar Bar \*/\}.*?\{/\* Matches Table \*/\}'

new_header = '''{/* Top Banner & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Value Bets &amp; Kelly Criterion (+EV)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {filteredPicks.length} Value Edges
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Algorithmically identified positive expected value (+EV) and mathematical Kelly fractional stakes.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Avg Edge</div>
              <div className="text-sm font-bold font-mono text-emerald-700">
                +{filteredPicks.length > 0 ? (filteredPicks.reduce((sum, p) => sum + p.edge, 0) / filteredPicks.length).toFixed(1) : '0.0'}%
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center min-w-[85px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Max Edge</div>
              <div className="text-sm font-bold font-mono text-indigo-700">
                +{filteredPicks.length > 0 ? Math.max(...filteredPicks.map(p => p.edge)).toFixed(1) : '0.0'}%
              </div>
            </div>
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
              label="Edge Filter"
              value={edgeFilter}
              onChange={setEdgeFilter}
              options={[
                { value: 'ALL', label: 'All Value Bets' },
                { value: 'HIGH', label: 'High Edge (>5%)' },
                { value: 'MEDIUM', label: 'Medium Edge (>2%)' },
                { value: 'LOW', label: 'Marginal Edge (>0%)' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Showing matches count */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <span>Showing <strong>{filteredPicks.length}</strong> positive EV bets</span>
        {(searchQuery || selectedLeague !== 'All' || selectedDate !== 'All' || edgeFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedLeague('All');
              setSelectedDate('All');
              setEdgeFilter('ALL');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Matches Table */}'''

content = re.sub(pattern, new_header, content, flags=re.DOTALL)

with open('src/components/BinaryPicksPage.jsx', 'w') as f:
    f.write(content)

