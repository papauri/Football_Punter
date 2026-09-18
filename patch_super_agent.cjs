const fs = require('fs');

let content = fs.readFileSync('engine.js', 'utf8');

// 1. Add starDependency to initializeTeamDatabase
content = content.replace(/(lineHeight: \d+, counterVelocity: \d+) \}/g, (match, p1) => {
    return `${p1}, starDependency: 5 }`;
});

// Update specific top teams manually for accuracy
const topTeams = {
    'Manchester City': 6,  // Deep squad
    'Liverpool': 7,
    'Arsenal': 9,          // Highly dependent on Odegaard/Saka
    'Chelsea': 7,
    'Tottenham Hotspur': 8, // Son dependency
    'Real Madrid': 7,
    'Barcelona': 8,        // Yamal/Pedri dependency
    'Bayern Munich': 6,    // Deep squad
    'Bayer Leverkusen': 8, // Wirtz dependency
    'Nottingham Forest': 8,
    'Everton': 9
};

for (const [team, dep] of Object.entries(topTeams)) {
    const regex = new RegExp(`("${team}": \\{.*?)starDependency: 5 (\\})`, 'g');
    content = content.replace(regex, `$1starDependency: ${dep} $2`);
}

// 2. Add starDependency to getTeamRating
content = content.replace(
    'this.teamDb[teamName] = { attack, defense, elo, xGForm, lineHeight, counterVelocity };',
    'const starDependency = 5 + (seed % 4);\n\n    this.teamDb[teamName] = { attack, defense, elo, xGForm, lineHeight, counterVelocity, starDependency };'
);

// 3. Add getRefereeProfile to SoccerEngine
if (!content.includes('getRefereeProfile')) {
    const refFunc = `
  // Retrieves referee strictness profile (1-10)
  getRefereeProfile(refereeName) {
    const refs = {
      'Anthony Taylor': { strictness: 7 },
      'Michael Oliver': { strictness: 8 },
      'Simon Hooper': { strictness: 4 },
      'Stuart Attwell': { strictness: 6 },
      'Paul Tierney': { strictness: 5 },
      'Mateu Lahoz': { strictness: 10 },
      'Clement Turpin': { strictness: 7 }
    };
    return refs[refereeName] || { strictness: 5 }; // default neutral ref
  }

  computeTacticalMultiplier`;
    content = content.replace('  computeTacticalMultiplier', refFunc);
}

// 4. Update computeDixonColesProbabilities signature and internals
content = content.replace(
    'computeDixonColesProbabilities(homeTeam, awayTeam) {',
    'computeDixonColesProbabilities(homeTeam, awayTeam, options = {}) {'
);

const missingStarLogic = `
    const home = { ...this.getTeamRating(homeTeam) };
    const away = { ...this.getTeamRating(awayTeam) };

    // Apply Key Player Gravity (Missing Star Factor)
    if (options.homeMissingStar) {
      const penalty = home.starDependency * 0.06; // up to 60% penalty on xGForm
      home.xGForm = Math.max(0.2, home.xGForm - penalty);
      home.attack = Math.max(0.5, home.attack * (1 - (home.starDependency * 0.03)));
      home.counterVelocity = Math.max(1, home.counterVelocity - 3);
    }
    if (options.awayMissingStar) {
      const penalty = away.starDependency * 0.06;
      away.xGForm = Math.max(0.2, away.xGForm - penalty);
      away.attack = Math.max(0.5, away.attack * (1 - (away.starDependency * 0.03)));
      away.counterVelocity = Math.max(1, away.counterVelocity - 3);
    }
    
    // Referee Profiling Asymmetry
    let refereeMultiplierHome = 1.0;
    let refereeMultiplierAway = 1.0;
    if (options.referee) {
      const ref = this.getRefereeProfile(options.referee);
      // Strict referee (>6) penalizes high counter teams
      if (ref.strictness > 6) {
         refereeMultiplierHome -= (home.counterVelocity * 0.01); 
         refereeMultiplierAway -= (away.counterVelocity * 0.01);
      } else if (ref.strictness < 5) {
         refereeMultiplierHome += (home.counterVelocity * 0.01);
         refereeMultiplierAway += (away.counterVelocity * 0.01);
      }
    }
`;

content = content.replace(
    /const home = this\.getTeamRating\(homeTeam\);\s*const away = this\.getTeamRating\(awayTeam\);/,
    missingStarLogic
);

// We need to make sure refereeMultiplier is applied to lambda and mu
content = content.replace(
    'const lambda = Math.max(0.4, home.attack * away.defense * (this.hyperparameters.homeAdvantage / 1.18) * 1.25 * homeTacticalBoost);',
    'const lambda = Math.max(0.4, home.attack * away.defense * (this.hyperparameters.homeAdvantage / 1.18) * 1.25 * homeTacticalBoost * refereeMultiplierHome);'
);

content = content.replace(
    'const mu = Math.max(0.3, away.attack * home.defense * 1.05 * awayTacticalBoost);',
    'const mu = Math.max(0.3, away.attack * home.defense * 1.05 * awayTacticalBoost * refereeMultiplierAway);'
);

// We also need to update evaluateYesterdayMatches so it calls computeDixonColesProbabilities correctly if it doesn't already pass options
// It passes `(m.home, m.away)`. We can leave it as is, since options defaults to {}

fs.writeFileSync('engine.js', content, 'utf8');
console.log('engine.js successfully patched with Key Player Gravity and Referee Profiling.');
