// Bulletproof Date & Time Formatter for Autonomous Patches, Post-Mortems, and Telemetry

export function formatSafeDateTime(val, fallback = null, tzSettings = {}) {
  const candidate = (val !== null && val !== undefined && val !== '') ? val : fallback;
  if (!candidate || candidate === 'Invalid Date') {
    return { date: 'Today', time: 'Recent', full: 'Recent' };
  }

  const tzZone = tzSettings?.zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const hour12 = tzSettings?.hour24 === false;

  const formatDate = (d) => {
    try {
      return {
        date: d.toLocaleDateString(undefined, { timeZone: tzZone, month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString([], { timeZone: tzZone, hour12, hour: '2-digit', minute: '2-digit' }),
        full: d.toLocaleString(undefined, { timeZone: tzZone, hour12, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: d.getTime()
      };
    } catch {
      // Fallback if timezone is invalid
      return {
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString([], { hour12, hour: '2-digit', minute: '2-digit' }),
        full: d.toLocaleString(undefined, { hour12, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: d.getTime()
      };
    }
  };

  // If candidate is a numeric timestamp
  if (typeof candidate === 'number' && !isNaN(candidate) && candidate > 0) {
    const d = new Date(candidate);
    if (!isNaN(d.getTime())) {
      return formatDate(d);
    }
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
      return { date: 'Today', time: 'Recent', full: 'Recent' };
    }

    // If candidate is a numeric string (epoch ms)
    if (/^\d{10,14}$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        const d = new Date(num);
        if (!isNaN(d.getTime())) {
          return formatDate(d);
        }
      }
    }

    // Try normal ISO / date parsing
    let d = new Date(trimmed);
    
    if (isNaN(d.getTime())) {
      // If candidate is a time string (e.g., "8:02:52 PM" or "20:02:52")
      if (trimmed.includes(':') || trimmed.includes('AM') || trimmed.includes('PM')) {
        const todayStr = new Date().toISOString().slice(0, 10);
        d = new Date(`${todayStr} ${trimmed}`);
      }
    }

    // If still invalid, try fallback if available
    if (isNaN(d?.getTime()) && fallback && fallback !== val) {
      const fd = new Date(fallback);
      if (!isNaN(fd.getTime())) {
        d = fd;
      }
    }

    if (!isNaN(d?.getTime())) {
      return formatDate(d);
    }

    // If it is already a clean string like "8:02:52 PM", use it safely
    return {
      date: 'Today',
      time: trimmed,
      full: trimmed,
      timestamp: Date.now()
    };
  }

  return { date: 'Today', time: 'Recent', full: 'Recent', timestamp: Date.now() };
}

export function formatRelativeDayTime(val, tzSettings = {}) {
  const parsed = formatSafeDateTime(val, null, tzSettings);
  if (parsed.full === 'Recent') return 'Upcoming';
  
  if (!parsed.timestamp) return parsed.full;
  const d = new Date(parsed.timestamp);
  
  const tzZone = tzSettings?.zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  let diffDays = 0;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tzZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date());
    const targetStr = formatter.format(d);
    
    const [y1, m1, day1] = todayStr.split('-').map(Number);
    const [y2, m2, day2] = targetStr.split('-').map(Number);
    
    const utc1 = Date.UTC(y1, m1 - 1, day1);
    const utc2 = Date.UTC(y2, m2 - 1, day2);
    
    diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  } catch (e) {
    const today = new Date(new Date().toDateString());
    const target = new Date(d.toDateString());
    diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  }

  if (diffDays === 0) return `Today ${parsed.time}`;
  if (diffDays === 1) return `Tomorrow ${parsed.time}`;
  if (diffDays === -1) return `Yesterday ${parsed.time}`;
  
  return parsed.full;
}

export function getLocalizedDateKey(val, tzSettings = {}) {
  const parsed = formatSafeDateTime(val, null, tzSettings);
  if (!parsed.timestamp) {
    if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
    return 'Upcoming';
  }
  
  const d = new Date(parsed.timestamp);
  const tzZone = tzSettings?.zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tzZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}
