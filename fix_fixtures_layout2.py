import re

with open('src/components/FixturesTablePage.jsx', 'r') as f:
    content = f.read()

# Let's clean up the whole section manually to ensure correct JSX structure
# find "{/* Showing matches count */}" until the table element.

pattern = r'\{/\* Showing matches count \*/\}.*?\{/\* Matches Table \*/\}'

replacement = '''{/* Showing matches count */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
            {accaMatchIds.size > 0 && typeof onClearSlip === 'function' && (
              <button
                onClick={onClearSlip}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Clear current bet slip"
              >
                <span>Clear Slip ({accaMatchIds.size})</span>
              </button>
            )}
        </div>
      </div>

      {/* Matches Table */}'''

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Let's fix another issue where we have `{/* Remove old action row & chips */}` down to `{/* Matches Table */}`
pattern2 = r'\{/\* Remove old action row & chips \*/\}.*?\{/\* Matches Table \*/\}'
content = re.sub(pattern2, '', content, flags=re.DOTALL)

with open('src/components/FixturesTablePage.jsx', 'w') as f:
    f.write(content)

