import fetch from 'node-fetch';
const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');
const d = String(today.getDate()).padStart(2, '0');
const todayStr = `${y}${m}${d}`;
const res = await fetch(`https://prod-public-api.livescore.com/v1/api/app/date/soccer/${todayStr}/1.00?countryCode=GB&locale=en&tz=%2B00%3A00`);
if (res.ok) {
  const data = await res.json();
  let count = 0;
  if (data.Stages) {
    for (const stage of data.Stages) {
      if (stage.Events) {
        for (const f of stage.Events) {
          count++;
        }
      }
    }
  }
  console.log(`LiveScore Matches for ${todayStr}:`, count);
} else {
  console.log('Failed:', res.status);
}
