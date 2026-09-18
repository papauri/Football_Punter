const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

if (!content.includes('const [historical30d, setHistorical30d] = useState([]);')) {
    content = content.replace(
        "const [isLoadingDateResults, setIsLoadingDateResults] = useState(false);",
        "const [isLoadingDateResults, setIsLoadingDateResults] = useState(false);\n  const [historical30d, setHistorical30d] = useState([]);"
    );
}

if (!content.includes('/api/historical-30d')) {
    content = content.replace(
        "const [activeSlipId, setActiveSlipId] = useState('accumulator-1');",
        `const [activeSlipId, setActiveSlipId] = useState('accumulator-1');
  
  useEffect(() => {
    fetch('/api/historical-30d')
      .then(res => res.json())
      .then(data => {
        if (data.matches) setHistorical30d(data.matches);
      })
      .catch(err => console.error("Error fetching 30d historical:", err));
  }, []);`
    );
}

content = content.replace(
    /<PerformanceChart historicalResults=\{[^}]+\} \/>/g,
    '<PerformanceChart historicalResults={historical30d} />'
);

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("Patched Dashboard for 30d history");
