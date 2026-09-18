with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

import re

base_active_matches_str = """  const baseActiveMatches = matches.filter(m => m.status !== 'FT' && !m.status?.includes('Full Time') && !m.status?.includes('Final') && m.score !== 'FT' && !m.score?.includes('FT'));"""

new_base_active_matches = """  const baseActiveMatches = matches.filter(m => m.status !== 'FT' && !m.status?.includes('Full Time') && !m.status?.includes('Final') && m.score !== 'FT' && !m.score?.includes('FT'));
  const baseScoreMatches = baseActiveMatches.filter(m => m.hasPrediction);
  const baseBinaryMatches = baseActiveMatches.filter(m => m.binaryModel && m.binaryModel.pick && (m.binaryModel.actionable === 'YES' || m.binaryModel.confidence >= 60));"""

text = text.replace(base_active_matches_str, new_base_active_matches)

with open('src/components/Dashboard.jsx', 'w') as f:
    f.write(text)
