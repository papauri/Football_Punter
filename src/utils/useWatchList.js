import { useState, useEffect, useCallback } from 'react';

// The user's own watch list: matches they star to follow, kept on this device and shared by every
// page. It used to be an automatic "kicks off within 4 hours" filter, which could not be added to
// and emptied itself the moment a match started, exactly when you want to watch it.

const STORAGE_KEY = 'soccer_watchlist'; // { [matchId]: addedAtMs }
const EVENT = 'soccer_watchlist_changed';
const KEEP_MS = 3 * 24 * 60 * 60 * 1000; // forget entries after three days

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const now = Date.now();
    const fresh = {};
    for (const [id, at] of Object.entries(raw || {})) if (now - Number(at) < KEEP_MS) fresh[id] = Number(at);
    return fresh;
  } catch {
    return {};
  }
}

function write(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
  } catch {}
}

export function useWatchList() {
  const [list, setList] = useState(read);

  useEffect(() => {
    const onChange = (e) => setList(e.detail || read());
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setList(read()); };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isWatched = useCallback((id) => id != null && Object.prototype.hasOwnProperty.call(list, String(id)), [list]);

  const toggle = useCallback((id) => {
    if (id == null) return;
    const next = { ...read() };
    const key = String(id);
    if (next[key]) delete next[key];
    else next[key] = Date.now();
    setList(next);
    write(next);
  }, []);

  return { isWatched, toggle, count: Object.keys(list).length };
}
