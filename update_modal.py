import re

with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

# 1. Update state for Today's Modal
text = text.replace(
    "const [showYesterdayProofModal, setShowYesterdayProofModal] = useState(false);",
    "const [showYesterdayProofModal, setShowYesterdayProofModal] = useState(false);\n  const [showTodayProofModal, setShowTodayProofModal] = useState(false);"
)

# 2. Make Today's card a button
card_pattern = re.compile(r'<div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3\.5">(\s*)<div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">(\s*)<TrendingUp className="w-5 h-5" />(\s*)</div>(\s*)<div className="min-w-0">(\s*)<p className="text-\[11px\] font-medium text-slate-400 uppercase tracking-wider">Today\'s Accuracy</p>(\s*)<p className="text-lg font-bold text-white tracking-tight flex items-baseline gap-2">(\s*)<span>\{todayTotal > 0 \? `\$\{todayAccuracy\}%` : \'Awaiting FT\'\}</span>(\s*)\{todayTotal > 0 && \((\s*)<span className="text-xs font-medium text-emerald-400 font-mono">(\s*)\(\{todayHits\}/\{todayTotal\}\)(\s*)</span>(\s*)\}(\s*)</p>(\s*)<p className="text-\[11px\] text-slate-500 truncate">(\s*)\{todayTotal > 0 \? `Based on \$\{todayTotal\} completed matches today` : \'No completed matches today yet\'\}(\s*)</p>(\s*)</div>(\s*)</div>')

new_card = """<button 
            type="button"
            onClick={() => setShowTodayProofModal(true)}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/70 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all duration-150 cursor-pointer group hover:shadow-lg hover:shadow-emerald-950/20 relative"
            title="Click to view full match-by-match settlement proof for today's completed predictions"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-950/50 border border-emerald-800/60 group-hover:border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 transition-colors">
              <TrendingUp className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-medium text-slate-400 group-hover:text-emerald-300 uppercase tracking-wider transition-colors">
                  Today's Accuracy
                </p>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/90 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover:bg-emerald-900 transition-colors shrink-0">
                  Proof <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight flex items-baseline gap-2">
                <span>{todayTotal > 0 ? `${todayAccuracy}%` : 'Awaiting FT'}</span>
                {todayTotal > 0 && (
                  <span className="text-xs font-medium text-emerald-400 font-mono">
                    ({todayHits}/{todayTotal})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 group-hover:text-slate-300 truncate transition-colors flex items-center gap-1">
                {todayTotal > 0 
                  ? `Click to view all ${todayTotal} completed matches`
                  : 'Click to open settlement proof audit'}
              </p>
            </div>
          </button>"""

text = card_pattern.sub(new_card, text)

# 3. Add the TodayProofModal component call next to YesterdayProofModal
modal_call_pattern = re.compile(r'<YesterdayProofModal[\s\S]*?onNavigateToResults=\{\(\) => \{\s*setShowYesterdayProofModal\(false\);\s*setActiveTab\(\'results\'\);\s*\}\}\s*/>')

today_modal_call = """<ProofModal
          isOpen={showYesterdayProofModal}
          title="Yesterday's Prediction Accuracy & Settlement Proof"
          stats={yesterdayStats}
          matchesList={state?.yesterdayMatches || []}
          postMortems={state?.mistakePostMortems || []}
          onClose={() => setShowYesterdayProofModal(false)}
          onAnalyzeMatch={handleAnalyzeMatch}
          onNavigateToResults={() => {
            setShowYesterdayProofModal(false);
            setActiveTab('results');
          }}
          isToday={false}
        />
        
        <ProofModal
          isOpen={showTodayProofModal}
          title="Today's Live Accuracy & Settlement Proof"
          stats={{ total: todayTotal, correctPredictions: todayHits, accuracy: parseFloat(todayAccuracy) }}
          matchesList={todayCompleted}
          postMortems={state?.mistakePostMortems || []}
          onClose={() => setShowTodayProofModal(false)}
          onAnalyzeMatch={handleAnalyzeMatch}
          onNavigateToResults={() => {
            setShowTodayProofModal(false);
            setActiveTab('results');
          }}
          isToday={true}
        />"""

text = modal_call_pattern.sub(today_modal_call, text)

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)

