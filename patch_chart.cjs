const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');
if (!content.includes('import PerformanceChart from')) {
    content = content.replace(
      "import ResultsProofPage from './ResultsProofPage';",
      "import ResultsProofPage from './ResultsProofPage';\nimport PerformanceChart from './PerformanceChart';"
    );
}

if (!content.includes('<PerformanceChart historicalResults={')) {
    content = content.replace(
      "          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>",
      `          <ErrorBoundary key={activePage} onReset={() => fetchState(true)}>
            {activePage === 'results' && (
               <div className="mb-6">
                 <PerformanceChart historicalResults={auditedDateResults !== null ? auditedDateResults : (state?.yesterdayMatches && state.yesterdayMatches.length > 0 ? state.yesterdayMatches : [])} />
               </div>
            )}`
    );
}

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("Patched chart import");
