with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

import re

yesterday_modal = """        <ProofModal
          isOpen={showYesterdayProofModal}
          title="Yesterday's Prediction Accuracy & Settlement Proof"
          stats={state?.yesterdayStats || { total: 0, correctPredictions: 0, accuracy: 0 }}
          matchesList={state?.yesterdayMatches || []}
          postMortems={state?.mistakePostMortems || []}
          onClose={() => setShowYesterdayProofModal(false)}
          onAnalyzeMatch={handleAnalyzeMatch}
          onNavigateToResults={() => {
            setShowYesterdayProofModal(false);
            setActiveTab('results');
            setResultsDate(getYesterdayIso());
          }}
          isToday={false}
        />"""

today_modal = """

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

if yesterday_modal in text:
    text = text.replace(yesterday_modal, yesterday_modal + today_modal)
else:
    print("Could not find yesterday_modal block")

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)

