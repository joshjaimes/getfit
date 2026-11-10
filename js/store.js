// App state: one object kept in memory, saved to the phone's IndexedDB storage.
const DB = 'getfit', STORE = 'kv';
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
}
export const kvGet = k => tx('readonly', s => s.get(k));
export const kvSet = (k, v) => tx('readwrite', s => s.put(v, k));
export const kvDel = k => tx('readwrite', s => s.delete(k));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const defaults = () => ({
  v: 1,
  profile: { onboarded: false, sex: 'male', age: 25, heightCm: 175.26, weightKg: 77.1107, activity: 1.55, goal: 'maintain', rate: 1, custom: null },
  settings: { units: 'imperial', rest: 90, usdaKey: '' },
  customExercises: [],
  routines: [],
  schedule: [null, null, null, null, null, null, null], // Monday..Sunday -> routine id
  workouts: [],
  active: null,
  rest: null, // { end, total }
  entries: [],
  myFoods: [],
  meals: [],
  weights: [],
  measures: [],
  photos: [],
  stravaSkip: [], // Strava activities you removed, so they are not imported again
});

export let S = defaults();
export const UI = { progressTab: null, foodDate: null, tab: 'home', workoutOpen: false, summary: null, toast: null };

const subs = new Set();
const notify = () => subs.forEach(f => f());
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }

let timer;
export function saveNow() { clearTimeout(timer); return kvSet('state', JSON.stringify(S)).catch(() => {}); }
export function mut(fn) { fn(S); notify(); clearTimeout(timer); timer = setTimeout(saveNow, 200); }
export function ui(fn) { fn(UI); notify(); }

let toastTimer;
export function toast(msg) {
  ui(u => { u.toast = msg; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui(u => { u.toast = null; }), 2200);
}

export async function load() {
  try {
    const raw = await kvGet('state');
    if (raw) {
      const d = defaults(), p = JSON.parse(raw);
      S = { ...d, ...p, profile: { ...d.profile, ...p.profile }, settings: { ...d.settings, ...p.settings } };
    }
  } catch (e) { console.error('load failed', e); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  addEventListener('pagehide', saveNow);
}

export async function exportData() {
  const photos = {};
  for (const p of S.photos) photos[p.id] = await kvGet('photo:' + p.id);
  return JSON.stringify({ app: 'getfit', exported: new Date().toISOString(), state: S, photos });
}
export async function importData(text) {
  const d = JSON.parse(text);
  if (d.app !== 'getfit' || !d.state) throw new Error('Not a GetFit backup file');
  for (const id in (d.photos || {})) if (d.photos[id]) await kvSet('photo:' + id, d.photos[id]);
  const def = defaults();
  S = { ...def, ...d.state, profile: { ...def.profile, ...d.state.profile }, settings: { ...def.settings, ...d.state.settings } };
  await saveNow();
  notify();
}
export async function resetAll() {
  for (const p of S.photos) await kvDel('photo:' + p.id);
  await kvDel('strava'); // also forgets the Strava link
  S = defaults();
  await saveNow();
  notify();
}
