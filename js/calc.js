// Units, dates, and the calorie / protein / strength formulas.
import { S } from './store.js';

export const LB = 2.2046226218;
export const round = (n, d = 0) => { const m = 10 ** d; return Math.round(n * m) / m; };
export const isImp = () => S.settings.units === 'imperial';
export const wUnit = () => (isImp() ? 'lb' : 'kg');
export const lUnit = () => (isImp() ? 'in' : 'cm');
/** stored kg -> number in the user's unit */
export const fromKg = (kg, d = 1) => (kg == null ? null : round(isImp() ? kg * LB : kg, d));
export const toKg = v => (v == null ? null : isImp() ? v / LB : v);
export const fromCm = (cm, d = 1) => (cm == null ? null : round(isImp() ? cm / 2.54 : cm, d));
export const toCm = v => (v == null ? null : isImp() ? v * 2.54 : v);
export const num = n => Math.round(n).toLocaleString();

const pad = n => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return today(d); };
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // Monday = 0
export const weekStart = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - dayIdx(x)); return x; };
export const fmtDate = (s, opts = { month: 'short', day: 'numeric' }) => (typeof s === 'string' ? parseDate(s) : new Date(s)).toLocaleDateString(undefined, opts);
export function niceDate(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  return fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${pad(m)}m` : `${m}m ${pad(s % 60)}s`;
}
export const fmtClock = sec => `${Math.floor(sec / 60)}:${pad(Math.max(0, Math.floor(sec % 60)))}`;

export const ACTIVITY = [
  [1.2, 'Sedentary', 'Desk job, little exercise'],
  [1.375, 'Lightly active', 'Exercise 1-3 days a week'],
  [1.55, 'Moderately active', 'Exercise 3-5 days a week'],
  [1.725, 'Very active', 'Hard exercise 6-7 days a week'],
  [1.9, 'Extremely active', 'Physical job plus training'],
];
export const RATES = { cut: [0.5, 1, 1.5, 2], bulk: [0.25, 0.5, 0.75, 1], maintain: [] };

/**
 * Daily targets.
 * Calories: Mifflin-St Jeor BMR x activity = maintenance, then -/+ 500 kcal per lb/week of cut/bulk.
 * Protein: grams per kg of bodyweight by goal (cut 2.2, bulk 2.0, maintain 1.8). Height is used so that
 * at a BMI above 30 the extra weight only counts 40%, which keeps the target realistic.
 * Fat: 25% of calories (never under 0.6 g/kg). Carbs: whatever calories remain.
 */
export function targets(p = S.profile) {
  const w = p.weightKg, h = p.heightCm;
  const bmr = 10 * w + 6.25 * h - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * p.activity;
  const delta = p.goal === 'cut' ? -p.rate * 500 : p.goal === 'bulk' ? p.rate * 500 : 0;
  const floor = p.sex === 'male' ? 1500 : 1200;
  let calories = Math.round((tdee + delta) / 10) * 10;
  const floored = calories < floor;
  if (floored) calories = floor;
  const hm = h / 100, ref = 30 * hm * hm;
  const basis = w > ref ? ref + 0.4 * (w - ref) : w;
  const gkg = p.goal === 'cut' ? 2.2 : p.goal === 'bulk' ? 2.0 : 1.8;
  const protein = Math.round((basis * gkg) / 5) * 5;
  const fat = Math.round(Math.max((calories * 0.25) / 9, basis * 0.6) / 5) * 5;
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4 / 5) * 5);
  const auto = { calories, protein, carbs, fat };
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), delta, floored, floor, gkg, bmi: w / (hm * hm), auto, ...(p.custom || auto) };
}

/** Estimated one-rep max (Epley). */
export const e1rm = (w, r) => (!r || r < 1 ? 0 : r === 1 ? w : w * (1 + r / 30));

export const sumEntries = es => es.reduce((a, e) => {
  a.kcal += e.food.kcal * e.qty; a.p += e.food.p * e.qty; a.c += e.food.c * e.qty; a.f += e.food.f * e.qty; return a;
}, { kcal: 0, p: 0, c: 0, f: 0 });

export const workoutVolume = w => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done && s.type !== 'warmup' ? (s.weight || 0) * (s.reps || 0) : 0), 0), 0);
export const workoutSets = w => w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done && s.type !== 'warmup').length, 0);

/** Best-ever numbers for one exercise across a list of workouts. */
export function records(exId, workouts) {
  const r = { weight: 0, orm: 0, setVol: 0, sessionVol: 0, reps: 0 };
  for (const w of workouts) for (const e of w.exercises) {
    if (e.exerciseId !== exId) continue;
    let vol = 0;
    for (const s of e.sets) {
      if (!s.done || s.type === 'warmup') continue;
      const wt = s.weight || 0, rp = s.reps || 0;
      r.weight = Math.max(r.weight, wt); r.orm = Math.max(r.orm, e1rm(wt, rp));
      r.setVol = Math.max(r.setVol, wt * rp); r.reps = Math.max(r.reps, rp); vol += wt * rp;
    }
    r.sessionVol = Math.max(r.sessionVol, vol);
  }
  return r;
}
