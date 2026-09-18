const tzZone = 'America/New_York';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tzZone, year: 'numeric', month: '2-digit', day: '2-digit' });
console.log(formatter.format(new Date()));
