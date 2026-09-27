// The app's pages, in one place. The side menu and the header's page switcher both read this, so
// the two can no longer list different pages or name the same page differently.
export const PAGE_SECTIONS = [
  {
    title: 'Bet',
    pages: [
      { id: 'fixtures', label: 'Matches' },
      { id: 'binary', label: 'Value bets' },
      { id: 'scores', label: 'Goals' },
      { id: 'props', label: 'Corners & cards' },
      { id: 'acca', label: 'Bet slip' }
    ]
  },
  {
    title: 'Check',
    pages: [
      { id: 'results', label: 'Results' },
      { id: 'lineups', label: 'Lineups' },
      { id: 'deep-research', label: 'Match research' },
      { id: 'leagues', label: 'Leagues' }
    ]
  },
  {
    title: 'Settings',
    pages: [{ id: 'tuning', label: 'Settings' }]
  }
];

export const PAGE_LABELS = Object.fromEntries(PAGE_SECTIONS.flatMap(s => s.pages.map(p => [p.id, p.label])));

// Pages that were merged away. Old links and saved state land on the page that replaced them.
const REDIRECTS = { swarm: 'binary', alldaywinner: 'acca', patches: 'fixtures', autonomous: 'fixtures', timezone: 'tuning', logs: 'tuning' };

export function resolvePage(id) {
  const target = REDIRECTS[id] || id;
  return PAGE_LABELS[target] ? target : 'fixtures';
}
