const fs = require('fs');

let content = fs.readFileSync('engine.js', 'utf8');

// 1. Update the teams to include lineHeight and counterVelocity
content = content.replace(/\{ attack: ([^,]+), defense: ([^,]+), elo: ([^,]+), xGForm: ([^} ]+) \}/g, (match, atk, def, elo, xg) => {
    // Default values
    let line = 5;
    let counter = 5;
    
    // Some basic heuristics based on elo / xg form for a dynamic default
    // We will let the specific top teams get manually updated below
    return `{ attack: ${atk}, defense: ${def}, elo: ${elo}, xGForm: ${xg}, lineHeight: ${line}, counterVelocity: ${counter} }`;
});

// Update specific top teams manually for accuracy
const topTeams = {
    'Manchester City': { line: 8, counter: 3 },
    'Liverpool': { line: 8, counter: 8 },
    'Arsenal': { line: 7, counter: 5 },
    'Chelsea': { line: 6, counter: 7 },
    'Tottenham Hotspur': { line: 10, counter: 7 },
    'Real Madrid': { line: 6, counter: 10 },
    'Barcelona': { line: 10, counter: 8 },
    'Bayern Munich': { line: 9, counter: 7 },
    'Bayer Leverkusen': { line: 8, counter: 8 },
    'Nottingham Forest': { line: 3, counter: 9 },
    'Everton': { line: 2, counter: 4 }
};

for (const [team, stats] of Object.entries(topTeams)) {
    const regex = new RegExp(`("${team}": \\{.*?)lineHeight: 5, counterVelocity: 5 (\\})`, 'g');
    content = content.replace(regex, `$1lineHeight: ${stats.line}, counterVelocity: ${stats.counter} $2`);
}

// 2. Add computeTacticalMultiplier
if (!content.includes('computeTacticalMultiplier')) {
    const multiplierFunc = `
  // Calculate tactical multiplier based on the Rock-Paper-Scissors dynamic
  // A team's attack gets boosted if their counter velocity exploits the opponent's high line
  computeTacticalMultiplier(team, opponent) {
    // Edge formula: (OpponentLine - 5) * (TeamCounter - 5)
    const edge = (opponent.lineHeight - 5) * (team.counterVelocity - 5);
    // Max positive edge = 25 -> 1.15 multiplier (+15%)
    // Max negative edge = -20 -> 0.88 multiplier (-12%)
    let multiplier = 1.0 + (edge * 0.006);
    return Math.max(0.85, Math.min(1.25, multiplier));
  }

  // -------------------------------------------------------------`;
    content = content.replace('  // -------------------------------------------------------------\n  // DIXON-COLES BIVARIATE POISSON INFERENCE ALGORITHM', multiplierFunc + '\n  // DIXON-COLES BIVARIATE POISSON INFERENCE ALGORITHM');
}

// 3. Update getTeamRating
content = content.replace(
    'const xGForm = (attack * 0.9) + (((seed >> 2) % 40) / 100);\n\n    this.teamDb[teamName] = { attack, defense, elo, xGForm };',
    'const xGForm = (attack * 0.9) + (((seed >> 2) % 40) / 100);\n    const lineHeight = 1 + (seed % 10);\n    const counterVelocity = 1 + ((seed >> 3) % 10);\n\n    this.teamDb[teamName] = { attack, defense, elo, xGForm, lineHeight, counterVelocity };'
);

// 4. Update computeDixonColesProbabilities
if (!content.includes('homeTacticalBoost')) {
    content = content.replace(
        /const lambda = Math\.max\(0\.4, home\.attack \* away\.defense \* \(this\.hyperparameters\.homeAdvantage \/ 1\.18\) \* 1\.25\);/,
        'const homeTacticalBoost = this.computeTacticalMultiplier(home, away);\n    const awayTacticalBoost = this.computeTacticalMultiplier(away, home);\n\n    // lambda = alpha_home * beta_away * homeAdvantage * homeTacticalBoost\n    const lambda = Math.max(0.4, home.attack * away.defense * (this.hyperparameters.homeAdvantage / 1.18) * 1.25 * homeTacticalBoost);'
    );
    content = content.replace(
        /const mu = Math\.max\(0\.3, away\.attack \* home\.defense \* 1\.05\);/,
        '// mu = alpha_away * beta_home * awayTacticalBoost\n    const mu = Math.max(0.3, away.attack * home.defense * 1.05 * awayTacticalBoost);'
    );
}

fs.writeFileSync('engine.js', content, 'utf8');
console.log('engine.js successfully patched with Stylistic Asymmetry Matrix.');
