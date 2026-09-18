const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

// Add import
content = content.replace(
  "import ResultsProofPage from './ResultsProofPage';",
  "import ResultsProofPage from './ResultsProofPage';\nimport PerformanceChart from './PerformanceChart';"
);

// Add chart
content = content.replace(
  "          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>",
  `          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>
            {activePage === 'results' && (
               <div className="mb-6">
                 <PerformanceChart historicalResults={state?.yesterdayMatches || []} />
               </div>
            )}`
);

fs.writeFileSync('src/components/Dashboard.jsx', content);
