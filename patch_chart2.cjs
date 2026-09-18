const fs = require('fs');
let content = fs.readFileSync('src/components/PerformanceChart.jsx', 'utf8');

content = content.replace(
    /const isHit = m\.actualWinner === predictedWinner;/g,
    "const isHit = m.isHit !== undefined ? Boolean(m.isHit) : (m.actualWinner === predictedWinner);"
);

fs.writeFileSync('src/components/PerformanceChart.jsx', content);
console.log("Patched chart isHit");
