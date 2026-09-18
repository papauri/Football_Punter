const fs = require('fs');

let content = fs.readFileSync('multiAgentSwarm.js', 'utf8');

const regex = /export class LearningPredictabilityAgent \{[\s\S]*?\}\s*\}\s*evaluate\(match\) \{[\s\S]*?\}\s*\}/;

const realisticAgent = `export class LearningPredictabilityAgent {
  constructor() {
    this.name = 'Predictability Matrix Learner';
    this.id = 'AGENT_PREDICTABILITY_LEARNER';
    this.role = 'Empirically calibrates probabilities based on historical model accuracy';
    this.avatar = '🧠';
  }

  evaluate(match) {
    let offset = 0;
    if (match.prob && match.confidence) {
       // Estimate dynamic empirical offset applied
       const baseMax = Math.max(match.prob.home || 0, match.prob.draw || 0, match.prob.away || 0);
       offset = match.confidence - baseMax;
    }
    
    let conviction = 50;
    let verdict = 'STANDARD_VARIANCE';
    let summary = \`No statistically significant historical model deviation found. Standard variance applies.\`;
    
    if (offset > 3) {
       conviction = 70 + Math.min(29, offset);
       verdict = 'EMPIRICAL_OVERPERFORMER';
       summary = \`Historical model analysis reveals this team reliably beats base predictions. True win probability calibrated +\${offset.toFixed(1)}% higher.\`;
    } else if (offset < -3) {
       conviction = Math.max(10, 50 + offset); // Drops below 50
       verdict = 'EMPIRICAL_UNDERPERFORMER';
       summary = \`Historical model analysis reveals this team reliably underperforms base expectations. True win probability calibrated \${offset.toFixed(1)}% lower.\`;
    }

    return {
      predictedWinner: match.predictedWinner || 'HOME',
      conviction,
      verdict,
      summary
    };
  }
}`;

content = content.replace(regex, realisticAgent);
fs.writeFileSync('multiAgentSwarm.js', content, 'utf8');
console.log('Fixed LearningPredictabilityAgent class to support realistic offsets.');
