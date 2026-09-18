const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

if (!content.includes('/api/historical-30d')) {
    content = content.replace(
        "const handleFetchDateResults = useCallback(async (dateStr) => {",
        `useEffect(() => {
    fetch('/api/historical-30d')
      .then(res => res.json())
      .then(data => {
        if (data.matches) setHistorical30d(data.matches);
      })
      .catch(err => console.error("Error fetching 30d historical:", err));
  }, []);

  const handleFetchDateResults = useCallback(async (dateStr) => {`
    );
}

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("Patched 30d fetch");
