import re
import sys

def add_date_filter(filename):
    with open(filename, "r") as f:
        content = f.read()

    # Check if selectedDate already exists
    if "selectedDate" in content:
        print(f"{filename} already has selectedDate")
        return

    # Add state
    content = content.replace("const [selectedLeague, setSelectedLeague] = useState('All');", 
                              "const [selectedLeague, setSelectedLeague] = useState('All');\n  const [selectedDate, setSelectedDate] = useState('All');")

    # Add dateOptions logic
    date_options_code = """
  // Extract unique date options
  const dateOptions = useMemo(() => {
    const dates = {};
    matches.forEach(m => {
      const dKey = m.dateIso ? m.dateIso.slice(0, 10) : (m.date ? m.date.slice(0, 10) : 'Upcoming');
      dates[dKey] = (dates[dKey] || 0) + 1;
    });
    const keys = Object.keys(dates).sort();
    return [
      { value: 'All', label: `All Dates (${matches.length})` },
      ...keys.map(k => ({ value: k, label: `${k} (${dates[k]})` }))
    ];
  }, [matches]);
"""
    content = re.sub(r'(const leagueOptions.*?}, \[matches\]\);)', r'\1\n' + date_options_code, content, flags=re.DOTALL)

    # Update filter logic
    if "if (selectedLeague !== 'All' && m.league !== selectedLeague) return false;" in content:
        filter_addition = """
      if (selectedDate !== 'All') {
        const mDate = m.dateIso ? m.dateIso.slice(0, 10) : (m.date ? m.date.slice(0, 10) : 'Upcoming');
        if (mDate !== selectedDate) return false;
      }"""
        content = content.replace("if (selectedLeague !== 'All' && m.league !== selectedLeague) return false;", 
                                  "if (selectedLeague !== 'All' && m.league !== selectedLeague) return false;" + filter_addition)
    
    # Update useMemo dependency array for filtered/sorted matches
    # This might be tricky via regex, so we'll look for `searchQuery, selectedLeague`
    content = re.sub(r'(\[matches, searchQuery, selectedLeague)(, sortBy\])', r'\1, selectedDate\2', content)
    content = re.sub(r'(\[matches, searchQuery, selectedLeague)(, sortBy, filterMode\])', r'\1, selectedDate\2', content)

    # Add UniformDropdown for Date
    dropdown_code = """
            <UniformDropdown
              label="Date"
              value={selectedDate}
              onChange={setSelectedDate}
              options={dateOptions}
            />"""
    content = re.sub(r'(<UniformDropdown\s*label="League".*?/>)', r'\1' + dropdown_code, content, flags=re.DOTALL)

    # Add selectedDate check to clear filters
    content = re.sub(r'searchQuery \|\| selectedLeague !== \'All\'', r'searchQuery || selectedLeague !== \'All\' || selectedDate !== \'All\'', content)
    content = re.sub(r'setSelectedLeague\(\'All\'\);', r'setSelectedLeague(\'All\');\n                  setSelectedDate(\'All\');', content)

    # Also display date in table rows
    # <span>•</span>
    # <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.time}</span>
    
    # Let's find where time is rendered
    time_display = r'(<Clock className="w-3 h-3" />{m\.time || [^}]+}</span>)'
    # We want to add date before time
    content = re.sub(
        r'(<span>•</span>\s*<span className="flex items-center gap-1"><Clock className="w-3 h-3" />{[^}]+}</span>)',
        r'<span>•</span>\n                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.date ? m.date.slice(0,10) : \'Upcoming\'}</span>\n                                  <span>•</span>\n                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.time}</span>',
        content
    )

    with open(filename, "w") as f:
        f.write(content)
    print(f"Updated {filename}")

if __name__ == "__main__":
    add_date_filter("src/components/ScoresTablePage.jsx")
    add_date_filter("src/components/BinaryPicksPage.jsx")
