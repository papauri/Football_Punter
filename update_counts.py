import re
with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

replacement = """  const matches = state.matches || [];
  
  // Base active matches
  const baseActiveMatches = matches.filter(m => m.status !== 'FT' && !m.status?.includes('Full Time') && !m.status?.includes('Final') && m.score !== 'FT' && !m.score?.includes('FT'));
  const globalDateFilteredMatches = globalDateFilter === 'All' ? matches : matches.filter(m => getMatchDateKey(m, tzSettings) === globalDateFilter);
  const dateFilteredActiveMatches = globalDateFilter === 'All' ? baseActiveMatches : baseActiveMatches.filter(m => getMatchDateKey(m, tzSettings) === globalDateFilter);
  
  const activeMatchesCount = dateFilteredActiveMatches.length;

  const activeMatchesCountByLeague = dateFilteredActiveMatches.reduce((acc, m) => {
    if (m.league) acc[m.league] = (acc[m.league] || 0) + 1;
    return acc;
  }, {});"""

text = re.sub(
    r"  const matches = state\.matches \|\| \[\];\s*const activeMatchesCount = matches\.filter\(.*?length;\s*const activeMatchesCountByLeague = matches\.reduce\(\(acc, m\) => \{\s*if \(m\.league\) acc\[m\.league\] = \(acc\[m\.league\] \|\| 0\) \+ 1;\s*return acc;\s*\}, \{\}\);",
    replacement,
    text,
    flags=re.DOTALL
)

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)

