with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

import re

# We will dynamically calculate today's active accuracy based on the `matches` array
# We will insert this calculation near where yesterdayStats is defined.

insertion_code = """  const yesterdayStats = state.yesterdayStats || {
    total: 0,
    correctPredictions: 0,
    accuracy: 0
  };

  // Calculate Today's Accuracy dynamically from the loaded matches
  const todayCompleted = (matches || []).filter(m => {
    return m.status === 'FT' || m.status?.includes('Full Time') || m.status?.includes('Final') || m.score === 'FT' || m.score?.includes('FT');
  });
  let todayHits = 0;
  todayCompleted.forEach(m => {
     if (m.goals && m.goals.home !== null && m.goals.away !== null && m.binaryModel?.pick) {
         const hG = m.goals.home;
         const aG = m.goals.away;
         const actual = hG > aG ? 'HOME' : aG > hG ? 'AWAY' : 'DRAW';
         if (actual === m.binaryModel.pick) todayHits++;
     }
  });
  const todayTotal = todayCompleted.length;
  const todayAccuracy = todayTotal > 0 ? ((todayHits / todayTotal) * 100).toFixed(1) : '0.0';
"""

text = re.sub(
    r"  const yesterdayStats = state\.yesterdayStats \|\| \{\s*total: 0,\s*correctPredictions: 0,\s*accuracy: 0\s*\};",
    insertion_code,
    text
)

# And now we will display it in the header
# We will replace the "Database Depth" block with a "Today's Live Accuracy" block

db_block_pattern = re.compile(r'<div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3\.5">.*?<Database className="w-5 h-5" />.*?</div>\s*</div>', re.DOTALL)

accuracy_block = """<div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Today's Accuracy</p>
              <p className="text-lg font-bold text-white tracking-tight flex items-baseline gap-2">
                <span>{todayTotal > 0 ? `${todayAccuracy}%` : 'Awaiting FT'}</span>
                {todayTotal > 0 && (
                  <span className="text-xs font-medium text-emerald-400 font-mono">
                    ({todayHits}/{todayTotal})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {todayTotal > 0 ? `Based on ${todayTotal} completed matches today` : 'No completed matches today yet'}
              </p>
            </div>
          </div>"""

text = db_block_pattern.sub(accuracy_block, text)

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)

