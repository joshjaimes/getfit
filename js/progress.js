// Progress tab: workout analytics, nutrition report, bodyweight, measurements and photos.
import { html, useState, useEffect, useRef, Sheet, NumInput, Seg, Field, LineChart, BarChart, icon, loadImage } from './ui.js';
import { S, UI, mut, uid, toast, kvGet, kvSet, kvDel } from './store.js';
import { MUSCLES, MEASURES } from './data.js';
import { fromKg, toKg, fromCm, toCm, wUnit, lUnit, today, addDays, fmtDate, weekStart, e1rm, records, workoutVolume, workoutSets, targets, sumEntries, num, round, DAYS, parseDate } from './calc.js';
import { exById, ExercisePicker } from './workout.js';
import { Calendar } from './calendar.js';
import { isImp, fmtDur } from './calc.js';

export function logWeight(kg, date = today()) {
  mut(s => {
    const i = s.weights.findIndex(w => w.date === date);
    if (i >= 0) s.weights[i].kg = kg; else { s.weights.push({ date, kg }); s.weights.sort((a, b) => a.date.localeCompare(b.date)); }
    s.profile.weightKg = s.weights[s.weights.length - 1].kg; // calorie and protein targets follow your latest weight
  });
}

/* ---------- workouts ---------- */
const METRICS = [['weight', 'Heaviest weight'], ['orm', 'Est. 1 rep max'], ['vol', 'Session volume'], ['reps', 'Most reps']];
function WorkoutStats() {
  const done = S.workouts;
  const used = [...new Set(done.flatMap(w => w.exercises.map(e => e.exerciseId)))];
  const [exId, setExId] = useState(null), [metric, setMetric] = useState('orm'), [pick, setPick] = useState(false);
  const cur = exId && used.includes(exId) ? exId : used[used.length - 1];

  const ws = weekStart().getTime();
  const thisWeek = done.filter(w => w.start >= ws);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const a = ws - (7 - i) * 7 * 864e5, b = a + 7 * 864e5 + 36e5; // +1h covers daylight-saving weeks
    return { label: fmtDate(a + 12 * 36e5, { month: 'numeric', day: 'numeric' }), value: done.filter(w => w.start >= a - 36e5 && w.start < b - 36e5).length };
  });
  const muscle = {};
  thisWeek.forEach(w => w.exercises.forEach(e => { const m = exById(e.exerciseId).muscle; muscle[m] = (muscle[m] || 0) + e.sets.filter(s => s.done && s.type !== 'warmup').length; }));
  const mMax = Math.max(1, ...Object.values(muscle));
  const cardio = thisWeek.filter(w => w.source === 'strava');

  let points = [], rec = null;
  if (cur) {
    for (const w of done) {
      const e = w.exercises.find(x => x.exerciseId === cur);
      if (!e) continue;
      const r = records(cur, [w]);
      const y = metric === 'weight' ? r.weight : metric === 'orm' ? r.orm : metric === 'vol' ? r.sessionVol : r.reps;
      points.push({ label: fmtDate(w.start), y: metric === 'reps' ? y : fromKg(y, 1) });
    }
    rec = records(cur, done);
  }
  if (!done.length) return html`<div class="card empty">Finish your first workout to unlock charts, personal records and weekly muscle volume.</div>`;
  return html`
    <div class="card grid3">
      <div class="stat"><div class="n">${thisWeek.length}</div><div class="l">Workouts this week</div></div>
      <div class="stat"><div class="n">${num(fromKg(thisWeek.reduce((a, w) => a + workoutVolume(w), 0), 0))}</div><div class="l">Volume (${wUnit()})</div></div>
      <div class="stat"><div class="n">${thisWeek.reduce((a, w) => a + workoutSets(w), 0)}</div><div class="l">Sets</div></div>
    </div>
    ${cardio.length > 0 && html`<div class="card"><div class="card-title" style="margin-bottom:12px">Strava this week <span class="tag strava">STRAVA</span></div><div class="grid3">
      <div class="stat"><div class="n">${cardio.length}</div><div class="l">Activities</div></div>
      <div class="stat"><div class="n">${round(cardio.reduce((a, w) => a + (w.distance || 0), 0) / (isImp() ? 1609.344 : 1000), 1)}</div><div class="l">${isImp() ? 'Miles' : 'Km'}</div></div>
      <div class="stat"><div class="n">${fmtDur(cardio.reduce((a, w) => a + (w.moving || 0), 0) * 1000)}</div><div class="l">Moving time</div></div>
    </div></div>`}
    <div class="card"><div class="card-title">Workouts per week</div><div class="muted small" style="margin-bottom:8px">Last 8 weeks · ${done.length} total</div><${BarChart} bars=${weeks} /></div>
    <div class="card"><div class="card-title" style="margin-bottom:12px">Sets per muscle group this week</div>
      ${Object.keys(muscle).length ? MUSCLES.filter(m => muscle[m]).sort((a, b) => muscle[b] - muscle[a]).map(m => html`<div class="hbar"><span>${m}</span><div class="bar"><div style=${`width:${(muscle[m] / mMax) * 100}%`}></div></div><b>${muscle[m]}</b></div>`) : html`<div class="muted small">No sets logged yet this week.</div>`}
    </div>
    ${cur && html`<div class="h2"><span>Exercise progress</span></div>
    <div class="card">
      <button class="row between" style="width:100%" onClick=${() => setPick(true)}><span class="card-title accent ellip">${exById(cur).name}</span><span class="accent">${icon('down', 20)}</span></button>
      <div class="chips mt">${METRICS.map(([k, l]) => html`<button class=${'chip' + (k === metric ? ' on' : '')} onClick=${() => setMetric(k)}>${l}</button>`)}</div>
      <${LineChart} points=${points} fmt=${v => round(v, 1) + (metric === 'reps' ? '' : ' ' + wUnit())} />
      <div class="h2" style="margin-left:0"><span>Personal records</span></div>
      <div class="grid2">
        <div><div class="muted small">Heaviest weight</div><b>${fromKg(rec.weight)} ${wUnit()}</b></div>
        <div><div class="muted small">Est. 1 rep max</div><b>${fromKg(rec.orm)} ${wUnit()}</b></div>
        <div><div class="muted small">Best set volume</div><b>${num(fromKg(rec.setVol, 0))} ${wUnit()}</b></div>
        <div><div class="muted small">Best session volume</div><b>${num(fromKg(rec.sessionVol, 0))} ${wUnit()}</b></div>
      </div>
    </div>`}
    ${pick && html`<${Sheet} title="Exercises you have logged" onClose=${() => setPick(false)}>
      <div class="list">${used.map(id => exById(id)).sort((a, b) => a.name.localeCompare(b.name)).map(e => html`<button class="item tap" onClick=${() => { setExId(e.id); setPick(false); }}><div class="grow"><div class="title">${e.name}</div><div class="sub">${e.muscle}</div></div>${e.id === cur && html`<span class="accent">${icon('check')}</span>`}</button>`)}</div>
    <//>`}`;
}

/* ---------- nutrition ---------- */
function NutritionStats() {
  const [span, setSpan] = useState(7);
  const t = targets(), end = today();
  const days = Array.from({ length: span }, (_, i) => addDays(end, i - span + 1));
  const sums = days.map(d => sumEntries(S.entries.filter(e => e.date === d)));
  const logged = sums.filter(s => s.kcal > 0), n = logged.length || 1;
  const avg = k => logged.reduce((a, s) => a + s[k], 0) / n;
  const onTarget = logged.filter(s => Math.abs(s.kcal - t.calories) <= t.calories * 0.1).length;
  const protHit = logged.filter(s => s.p >= t.protein * 0.9).length;
  const bars = sums.map((s, i) => ({ label: span === 7 ? DAYS[(parseDate(days[i]).getDay() + 6) % 7] : i % 7 === 0 || i === span - 1 ? fmtDate(days[i], { month: 'numeric', day: 'numeric' }) : '', value: s.kcal, color: s.kcal > t.calories * 1.1 ? 'var(--red)' : 'var(--accent)' }));
  const mk = avg('p') * 4 + avg('c') * 4 + avg('f') * 9 || 1;
  return html`
    <${Seg} options=${[[7, 'Last 7 days'], [30, 'Last 30 days']]} value=${span} onChange=${setSpan} />
    <div class="card"><div class="card-title">Calories</div><div class="muted small" style="margin-bottom:8px">Dashed line is your ${num(t.calories)} cal goal</div><${BarChart} bars=${bars} goal=${t.calories} /></div>
    ${!logged.length ? html`<div class="card empty">Log food to see your averages here.</div>` : html`
    <div class="card grid2">
      <div class="stat"><div class="n">${num(avg('kcal'))}</div><div class="l">Avg calories (${logged.length} logged days)</div></div>
      <div class="stat"><div class="n" style=${'color:' + (avg('kcal') - t.calories > 0 ? 'var(--orange)' : 'var(--green)')}>${avg('kcal') - t.calories > 0 ? '+' : ''}${num(avg('kcal') - t.calories)}</div><div class="l">Avg vs goal</div></div>
      <div class="stat"><div class="n">${onTarget}/${logged.length}</div><div class="l">Days within 10% of goal</div></div>
      <div class="stat"><div class="n">${protHit}/${logged.length}</div><div class="l">Days protein goal hit</div></div>
    </div>
    <div class="card"><div class="card-title" style="margin-bottom:12px">Average macros</div>
      ${[['p', 'Protein', 'var(--teal)', t.protein, 4], ['c', 'Carbs', 'var(--yellow)', t.carbs, 4], ['f', 'Fat', 'var(--orange)', t.fat, 9]].map(([k, l, col, goal, cal]) => html`<div class="hbar" style="grid-template-columns:70px 1fr 110px"><span>${l}</span><div class="bar"><div style=${`width:${Math.min(100, (avg(k) / goal) * 100)}%;background:${col}`}></div></div><span class="muted small" style="text-align:right"><b style="color:var(--text)">${Math.round(avg(k))}g</b> / ${goal}g · ${Math.round((avg(k) * cal / mk) * 100)}%</span></div>`)}
    </div>`}`;
}

/* ---------- body ---------- */
export function Photo({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { let on = true; kvGet('photo:' + id).then(d => on && setSrc(d)); return () => { on = false; }; }, [id]);
  return src ? html`<img src=${src} alt="Progress photo" />` : null;
}
function BodyStats() {
  const [w, setW] = useState(null), [span, setSpan] = useState(90), [mform, setMform] = useState(null), [view, setView] = useState(null), [hist, setHist] = useState(false);
  const fileRef = useRef(null);
  const cutoff = addDays(today(), -span);
  const ws = S.weights.filter(x => span === 0 || x.date >= cutoff);
  const trend = ws.map((x, i) => { const a = ws.slice(Math.max(0, i - 6), i + 1); return fromKg(a.reduce((s, y) => s + y.kg, 0) / a.length, 1); });
  const last = S.weights[S.weights.length - 1], first = ws[0];
  const change = last && first ? fromKg(last.kg, 1) - fromKg(first.kg, 1) : 0;
  const latestM = k => { for (let i = S.measures.length - 1; i >= 0; i--) if (S.measures[i].vals[k] != null) return S.measures[i]; return null; };
  const firstM = k => S.measures.find(m => m.vals[k] != null);
  const disp = (k, v) => (k === 'Body fat %' ? round(v, 1) : fromCm(v, 1));
  const KEYS = MEASURES.concat('Body fat %');
  const addPhoto = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const c = await loadImage(file, 1280), id = uid();
      await kvSet('photo:' + id, c.toDataURL('image/jpeg', 0.82));
      mut(s => { s.photos.push({ id, date: today() }); });
    } catch (err) { toast('Could not save that photo'); }
  };
  const saveM = () => {
    const vals = {};
    KEYS.forEach(k => { if (mform[k] != null) vals[k] = k === 'Body fat %' ? mform[k] : toCm(mform[k]); });
    if (!Object.keys(vals).length) return toast('Enter at least one measurement');
    mut(s => { const d = today(), ex = s.measures.find(m => m.date === d); if (ex) Object.assign(ex.vals, vals); else s.measures.push({ date: d, vals }); });
    setMform(null);
  };
  return html`
    <div class="card">
      <div class="row between"><div><div class="muted small">Current weight</div><div style="font-size:30px;font-weight:800">${last ? fromKg(last.kg, 1) : fromKg(S.profile.weightKg, 1)} <span class="muted" style="font-size:16px">${wUnit()}</span></div></div>
        ${ws.length > 1 && html`<div style="text-align:right"><div class="muted small">Change</div><b style=${'color:' + (change === 0 ? 'var(--muted)' : (change < 0) === (S.profile.goal !== 'bulk') ? 'var(--green)' : 'var(--orange)')}>${change > 0 ? '+' : ''}${round(change, 1)} ${wUnit()}</b></div>`}</div>
      <div class="row mt"><${NumInput} class="input grow" placeholder=${`Today's weight (${wUnit()})`} value=${w} onInput=${setW} />
        <button class="btn primary" disabled=${!w} onClick=${() => { logWeight(toKg(w)); setW(null); toast('Weight logged — targets updated'); }}>Log</button></div>
    </div>
    <div class="card">
      <div class="row between" style="margin-bottom:8px"><div class="card-title">Weight trend</div>${S.weights.length > 0 && html`<button class="accent small" onClick=${() => setHist(true)}>Edit entries</button>`}</div>
      <${Seg} options=${[[30, '1M'], [90, '3M'], [365, '1Y'], [0, 'All']]} value=${span} onChange=${setSpan} />
      <${LineChart} points=${ws.map(x => ({ label: fmtDate(x.date), y: fromKg(x.kg, 1) }))} trend=${ws.length > 3 ? trend : null} fmt=${v => round(v, 1)} />
      ${ws.length > 3 && html`<div class="muted small center">Dashed line is your 7-entry average, which smooths out daily swings.</div>`}
    </div>

    <div class="h2"><span>Measurements</span><button onClick=${() => setMform({})}>+ Log</button></div>
    ${!S.measures.length ? html`<div class="card empty">Track waist, chest, arms and more to see changes the scale misses.</div>` : html`<div class="list">${KEYS.filter(latestM).map(k => {
      const l = latestM(k), f = firstM(k), u = k === 'Body fat %' ? '%' : ' ' + lUnit(), diff = disp(k, l.vals[k]) - disp(k, f.vals[k]);
      return html`<div class="item"><div class="grow"><div class="title">${k === 'Body fat %' ? 'Body fat' : k}</div><div class="sub">${fmtDate(l.date)}</div></div>
        <div style="text-align:right"><b>${disp(k, l.vals[k])}${u}</b>${l !== f && html`<div class="sub">${diff > 0 ? '+' : ''}${round(diff, 1)}${u} since ${fmtDate(f.date)}</div>`}</div></div>`;
    })}</div>`}

    <div class="h2"><span>Progress photos</span><button onClick=${() => fileRef.current.click()}>+ Add</button></div>
    <input ref=${fileRef} type="file" accept="image/*" style="display:none" onChange=${addPhoto} />
    ${!S.photos.length ? html`<div class="card empty">Photos stay on this phone only.</div>` : html`<div class="photos">${S.photos.slice().reverse().map(p => html`<button class="ph" onClick=${() => setView(p)}><${Photo} id=${p.id} /><div class="cap">${fmtDate(p.date, { month: 'short', day: 'numeric', year: '2-digit' })}</div></button>`)}</div>`}

    ${mform && html`<${Sheet} title="Log measurements" onClose=${() => setMform(null)} action=${html`<button onClick=${saveM}>Save</button>`}>
      <div class="grid2">${KEYS.map(k => html`<${Field} label=${k === 'Body fat %' ? k : `${k} (${lUnit()})`}><${NumInput} value=${mform[k]} onInput=${v => setMform({ ...mform, [k]: v })} placeholder=${latestM(k) ? disp(k, latestM(k).vals[k]) : ''} /><//>`)}</div>
      <div class="hint" style="margin-bottom:14px">Fill in only the ones you measured today.</div>
      <button class="btn primary block" onClick=${saveM}>Save</button>
    <//>`}
    ${view && html`<${Sheet} full title=${fmtDate(view.date, { month: 'long', day: 'numeric', year: 'numeric' })} onClose=${() => setView(null)}>
      <div class="bigphoto"><${Photo} id=${view.id} /></div>
      <button class="btn block danger mt" onClick=${() => { if (confirm('Delete this photo?')) { kvDel('photo:' + view.id); mut(s => { s.photos = s.photos.filter(p => p.id !== view.id); }); setView(null); } }}>Delete photo</button>
    <//>`}
    ${hist && html`<${Sheet} title="Weight entries" onClose=${() => setHist(false)}>
      <div class="list">${S.weights.slice().reverse().map(x => html`<div class="item"><div class="grow">${fmtDate(x.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div><b>${fromKg(x.kg, 1)} ${wUnit()}</b>
        <button class="icon-btn muted" aria-label="Delete" onClick=${() => mut(s => { s.weights = s.weights.filter(y => y.date !== x.date); if (s.weights.length) s.profile.weightKg = s.weights[s.weights.length - 1].kg; })}>${icon('trash', 20)}</button></div>`)}</div>
    <//>`}`;
}

export function ProgressTab() {
  const [tab, setTab] = useState(() => { const t = UI.progressTab || 'Workouts'; UI.progressTab = null; return t; });
  return html`<div class="screen">
    <div class="h1">Progress</div>
    <${Seg} options=${['Workouts', 'Nutrition', 'Body', 'Calendar']} value=${tab} onChange=${setTab} />
    ${tab === 'Calendar' ? html`<${Calendar} />` : tab === 'Workouts' ? html`<${WorkoutStats} />` : tab === 'Nutrition' ? html`<${NutritionStats} />` : html`<${BodyStats} />`}
  </div>`;
}
