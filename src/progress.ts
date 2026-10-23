// Best stars per level, kept in the browser. Storage can be missing (private mode), so every access is guarded.
const KEY = 'family-adventure-stars';

export function loadStars(): number[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function saveStars(level: number, stars: number) {
  const all = loadStars();
  all[level] = Math.max(all[level] ?? 0, stars);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* not saved, still playable */ }
}
