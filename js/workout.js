// Workout tab: schedule, routines, live workout logging, history.
import { html, useState, useEffect, Sheet, ActionSheet, NumInput, Field, icon } from './ui.js';
import { S, UI, mut, ui, uid, toast } from './store.js';
import { EXERCISES, MUSCLES, EQUIPMENT, SPLITS, slug } from './data.js';
import { StravaDetail, stravaLine } from './strava.js';
import { fromKg, toKg, wUnit, today, fmtDur, fmtClock, fmtDate, DAYS_FULL, dayIdx, records, workoutVolume, workoutSets, num } from './calc.js';

export const allEx = () => EXERCISES.concat(S.customExercises);
export const exById = id => allEx().find(e => e.id === id) || { id, name: 'Deleted exercise', muscle: 'Other', equipment: 'Other' };
const REST_OPTS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const restLabel = s => (s ? (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`) : 'Off');
const TYPE_LABEL = { normal: 'Normal set', warmup: 'Warm-up set', drop: 'Drop set', failure: 'Failure set' };
const TYPE_CH = { warmup: 'W', drop: 'D', failure: 'F' };

/** The sets you completed the last time you did this exercise. */
export function prevSets(exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const e = S.workouts[i].exercises.find(x => x.exerciseId === exId);
    if (e) { const d = e.sets.filter(s => s.done); if (d.length) return d; }
  }
  return [];
}

export function startWorkout(routine) {
  if (S.active) { ui(u => { u.workoutOpen = true; }); toast('You already have a workout in progress'); return; }
  mut(s => {
    s.active = {
      id: uid(), name: routine ? routine.name : 'Workout', start: Date.now(), routineId: routine ? routine.id : null,
      exercises: (routine ? routine.exercises : []).map(re => ({
        exerciseId: re.exerciseId, rest: re.rest, target: re.reps, note: '',
        sets: Array.from({ length: re.sets || 1 }, () => ({ weight: null, reps: null, type: 'normal', done: false })),
      })),
    };
  });
  ui(u => { u.workoutOpen = true; });
}

/* ---------- sound ---------- */
let actx;
function primeAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* no audio */ }
}
function beep() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!actx) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + t;
    o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.3, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    o.start(at); o.stop(at + 0.2);
  });
}

/* ---------- rest timer (always mounted so it fires even when the workout is minimized) ---------- */
export function RestBar() {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      if (!S.rest) return;
      if (Date.now() >= S.rest.end) { beep(); mut(s => { s.rest = null; }); toast('Rest over - next set!'); } else tick(x => x + 1);
    }, 250);
    return () => clearInterval(i);
  }, []);
  if (!S.rest || !UI.workoutOpen) return null;
  const left = Math.max(0, (S.rest.end - Date.now()) / 1000);
  const adj = d => mut(s => { s.rest.end += d * 1000; s.rest.total = Math.max(s.rest.total + d, 1); });
  return html`<div class="restbar">
    <div class="fill" style=${`transform:scaleX(${Math.min(1, left / S.rest.total)})`}></div>
    <div class="row between">
      <button class="btn sm" onClick=${() => adj(-15)}>-15s</button>
      <div class="row"><span>${icon('timer', 20)}</span><span class="time">${fmtClock(Math.ceil(left))}</span></div>
      <div class="row"><button class="btn sm" onClick=${() => adj(15)}>+15s</button><button class="btn sm" onClick=${() => mut(s => { s.rest = null; })}>Skip</button></div>
    </div>
  </div>`;
}

export function Elapsed({ start }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);
  return html`<span class="badge-timer">${fmtDur(Date.now() - start)}${S.rest && !UI.workoutOpen ? ` · rest ${fmtClock(Math.ceil(Math.max(0, S.rest.end - Date.now()) / 1000))}` : ''}</span>`;
}

/* ---------- exercise picker ---------- */
export function ExercisePicker({ onDone, onClose, single }) {
  const [q, setQ] = useState(''), [muscle, setMuscle] = useState('All'), [sel, setSel] = useState([]), [creating, setCreating] = useState(null);
  const list = allEx().filter(e => (muscle === 'All' || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const toggle = id => { if (single) { onDone([id]); return; } setSel(sel.includes(id) ? sel.filter(x => x !== id) : sel.concat(id)); };
  const create = () => {
    const name = creating.name.trim();
    if (!name) return toast('Give the exercise a name');
    const ex = { id: 'x-' + slug(name) + '-' + uid().slice(0, 4), name, muscle: creating.muscle, equipment: creating.equipment, custom: true };
    mut(s => { s.customExercises.push(ex); });
    setCreating(null); setQ(''); if (single) onDone([ex.id]); else setSel(sel.concat(ex.id));
  };
  return html`<${Sheet} full title=${single ? 'Choose exercise' : 'Add exercises'} onClose=${onClose}
      action=${!single && sel.length > 0 && html`<button onClick=${() => onDone(sel)}>Add (${sel.length})</button>`}>
    <div class="search">${icon('search', 20)}<input class="input" placeholder="Search exercises" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    <div class="chips">${['All'].concat(MUSCLES).map(m => html`<button class=${'chip' + (m === muscle ? ' on' : '')} onClick=${() => setMuscle(m)}>${m}</button>`)}</div>
    <div class="list">
      <button class="item tap accent" onClick=${() => setCreating({ name: q, muscle: muscle === 'All' ? 'Chest' : muscle, equipment: 'Barbell' })}>${icon('plus', 20)} Create custom exercise</button>
      ${list.map(e => html`<button class="item tap" onClick=${() => toggle(e.id)}>
        <div class="grow"><div class="title">${e.name}</div><div class="sub">${e.muscle} · ${e.equipment}${e.custom ? ' · Custom' : ''}</div></div>
        ${sel.includes(e.id) && html`<span class="accent">${icon('check')}</span>`}
      </button>`)}
    </div>
    ${creating && html`<${Sheet} title="New exercise" onClose=${() => setCreating(null)} action=${html`<button onClick=${create}>Save</button>`}>
      <${Field} label="Name"><input value=${creating.name} onInput=${e => setCreating({ ...creating, name: e.target.value })} /><//>
      <${Field} label="Muscle group"><select value=${creating.muscle} onChange=${e => setCreating({ ...creating, muscle: e.target.value })}>${MUSCLES.map(m => html`<option>${m}</option>`)}</select><//>
      <${Field} label="Equipment"><select value=${creating.equipment} onChange=${e => setCreating({ ...creating, equipment: e.target.value })}>${EQUIPMENT.map(m => html`<option>${m}</option>`)}</select><//>
    <//>`}
  <//>`;
}

/* ---------- routine editor ---------- */
function RoutineEditor({ routine, onClose }) {
  const [d, setD] = useState(() => JSON.parse(JSON.stringify(routine)));
  const [pick, setPick] = useState(false);
  const upd = (i, patch) => setD({ ...d, exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const move = (i, dir) => { const a = d.exercises.slice(), j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setD({ ...d, exercises: a }); };
  const save = () => {
    if (!d.name.trim()) return toast('Give the routine a name');
    if (!d.exercises.length) return toast('Add at least one exercise');
    mut(s => { const i = s.routines.findIndex(r => r.id === d.id); if (i >= 0) s.routines[i] = d; else s.routines.push(d); });
    onClose();
  };
  return html`<${Sheet} full title=${routine.name ? 'Edit routine' : 'New routine'} onClose=${onClose} action=${html`<button onClick=${save}>Save</button>`}>
    <${Field} label="Routine name"><input placeholder="e.g. Push day" value=${d.name} onInput=${e => setD({ ...d, name: e.target.value })} /><//>
    ${d.exercises.map((re, i) => html`<div class="card">
      <div class="row between"><div class="card-title grow ellip">${exById(re.exerciseId).name}</div>
        <button class="icon-btn muted" onClick=${() => move(i, -1)} aria-label="Move up"><span style="transform:rotate(180deg)">${icon('down', 20)}</span></button>
        <button class="icon-btn muted" onClick=${() => move(i, 1)} aria-label="Move down">${icon('down', 20)}</button>
        <button class="icon-btn muted" onClick=${() => setD({ ...d, exercises: d.exercises.filter((_, j) => j !== i) })} aria-label="Remove">${icon('trash', 20)}</button></div>
      <div class="grid3 mt">
        <${Field} label="Sets"><${NumInput} decimals=${false} value=${re.sets} onInput=${v => upd(i, { sets: Math.min(20, v || 1) })} /><//>
        <${Field} label="Reps"><input value=${re.reps} onInput=${e => upd(i, { reps: e.target.value })} placeholder="8-12" /><//>
        <${Field} label="Rest"><select value=${re.rest} onChange=${e => upd(i, { rest: +e.target.value })}>${REST_OPTS.map(o => html`<option value=${o}>${restLabel(o)}</option>`)}</select><//>
      </div>
    </div>`)}
    <button class="btn block" onClick=${() => setPick(true)}>${icon('plus', 20)} Add exercises</button>
    ${pick && html`<${ExercisePicker} onClose=${() => setPick(false)} onDone=${ids => { setD({ ...d, exercises: d.exercises.concat(ids.map(id => ({ exerciseId: id, sets: 3, reps: '8-12', rest: S.settings.rest }))) }); setPick(false); }} />`}
  <//>`;
}

/* ---------- past workout ---------- */
export function WorkoutDetail({ w, onClose }) {
  if (w.source === 'strava') return html`<${StravaDetail} w=${w} onClose=${onClose} />`;
  const saveRoutine = () => {
    mut(s => { s.routines.push({ id: uid(), name: w.name, exercises: w.exercises.map(e => ({ exerciseId: e.exerciseId, sets: e.sets.length, reps: String(e.sets[0].reps || 10), rest: e.rest || S.settings.rest })) }); });
    toast('Saved as a routine'); onClose();
  };
  const del = () => { if (confirm('Delete this workout?')) { mut(s => { s.workouts = s.workouts.filter(x => x.id !== w.id); }); onClose(); } };
  return html`<${Sheet} full title=${w.name} onClose=${onClose}>
    <div class="muted small center">${fmtDate(w.start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    <div class="card grid3 mt">
      <div class="stat"><div class="n">${fmtDur(w.end - w.start)}</div><div class="l">Duration</div></div>
      <div class="stat"><div class="n">${num(fromKg(workoutVolume(w), 0))}</div><div class="l">Volume (${wUnit()})</div></div>
      <div class="stat"><div class="n">${workoutSets(w)}</div><div class="l">Sets</div></div>
    </div>
    ${w.exercises.map(e => html`<div class="card">
      <div class="card-title accent">${exById(e.exerciseId).name}</div>
      ${e.note && html`<div class="muted small">${e.note}</div>`}
      ${e.sets.map((s, i) => html`<div class="row between mt"><span class="muted">${TYPE_CH[s.type] || i + 1}</span><span><b>${fromKg(s.weight || 0)}</b> ${wUnit()} × <b>${s.reps}</b></span></div>`)}
    </div>`)}
    <button class="btn block" onClick=${saveRoutine}>Save as routine</button>
    <button class="btn block danger mt" onClick=${del}>Delete workout</button>
  <//>`;
}

/* ---------- live workout ---------- */
export function ActiveWorkout() {
  const w = S.active;
  const [pick, setPick] = useState(false), [setMenu, setSetMenu] = useState(null), [exMenu, setExMenu] = useState(null), [restPick, setRestPick] = useState(null);
  if (!w) return null;
  const close = () => ui(u => { u.workoutOpen = false; });

  const toggleDone = (ei, si) => {
    primeAudio();
    const ex = w.exercises[ei], set = ex.sets[si];
    if (set.done) { mut(() => { set.done = false; }); return; }
    const prev = prevSets(ex.exerciseId), p = prev[si] || prev[prev.length - 1], above = ex.sets[si - 1];
    const reps = set.reps != null ? set.reps : above && above.reps != null ? above.reps : p ? p.reps : null;
    if (!reps) return toast('Enter your reps first');
    const weight = set.weight != null ? set.weight : above && above.weight != null ? above.weight : p ? p.weight : 0;
    mut(s => {
      set.reps = reps; set.weight = weight; set.done = true;
      const rest = ex.rest != null ? ex.rest : s.settings.rest;
      const next = w.exercises[ei + 1];
      const midSuperset = ex.superset && next && next.superset === ex.superset; // rest after the last exercise of the pair
      s.rest = rest && !midSuperset ? { end: Date.now() + rest * 1000, total: rest } : null;
    });
  };
  const finish = () => {
    const done = w.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length);
    if (!done.length) {
      if (confirm('No sets were completed. Discard this workout?')) { mut(s => { s.active = null; s.rest = null; }); close(); }
      return;
    }
    const pending = w.exercises.some(e => e.sets.some(s => !s.done));
    if (pending && !confirm('Some sets are not checked off. Finish anyway? Unchecked sets will not be saved.')) return;
    const fin = { ...w, exercises: done, end: Date.now() };
    const prs = [];
    for (const e of done) {
      const before = records(e.exerciseId, S.workouts), now = records(e.exerciseId, [fin]);
      if (before.orm > 0 && (now.weight > before.weight || now.orm > before.orm + 0.01)) prs.push(exById(e.exerciseId).name);
    }
    mut(s => { s.workouts.push(fin); s.active = null; s.rest = null; });
    ui(u => { u.workoutOpen = false; u.summary = { w: fin, prs }; });
  };
  const discard = () => { if (confirm('Discard this workout? Nothing will be saved.')) { mut(s => { s.active = null; s.rest = null; }); close(); } };
  const moveEx = (i, dir) => mut(() => { const a = w.exercises, j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; });
  const superset = i => mut(() => {
    const a = w.exercises[i], b = w.exercises[i + 1];
    if (a.superset) { const id = a.superset; w.exercises.forEach(e => { if (e.superset === id) delete e.superset; }); } else if (b) { const id = b.superset || Date.now(); a.superset = id; b.superset = id; }
  });

  return html`<div class="overlay">
    <div class="wk-head">
      <button class="icon-btn" onClick=${close} aria-label="Minimize">${icon('down')}</button>
      <div class="grow center">${icon('timer', 16)} <${Elapsed} start=${w.start} /></div>
      <button class="btn sm primary" onClick=${finish}>Finish</button>
    </div>
    <div class="overlay-body">
      <input class="wk-name" value=${w.name} onInput=${e => mut(() => { w.name = e.target.value; })} />
      ${!w.exercises.length && html`<div class="empty">Add an exercise to get started.</div>`}
      ${w.exercises.map((ex, ei) => {
        const info = exById(ex.exerciseId), prev = prevSets(ex.exerciseId);
        let n = 0;
        return html`<div class="ex" key=${ex.exerciseId + ei}>
          <div class="ex-head">
            <div class="ex-name">${info.name} ${ex.superset && html`<span class="tag ss">SUPERSET</span>`}</div>
            <button class="btn sm" onClick=${() => setRestPick(ei)}>${icon('timer', 16)} ${restLabel(ex.rest != null ? ex.rest : S.settings.rest)}</button>
            <button class="icon-btn" onClick=${() => setExMenu(ei)} aria-label="Exercise options">${icon('more')}</button>
          </div>
          <input class="ex-note" placeholder=${ex.target ? `Target: ${ex.target} reps · add a note` : 'Add a note'} value=${ex.note || ''} onInput=${e => mut(() => { ex.note = e.target.value; })} />
          <div class="sets">
            <div class="set head"><span>Set</span><span>Previous</span><span>${wUnit()}</span><span>Reps</span><span></span></div>
            ${ex.sets.map((s, si) => {
              const p = prev[si];
              const label = TYPE_CH[s.type] || ++n;
              return html`<div class=${'set' + (s.done ? ' done' : '')}>
                <button class=${'no ' + s.type} onClick=${() => setSetMenu({ ei, si })}>${label}</button>
                <span class="prev">${p ? `${fromKg(p.weight || 0)} × ${p.reps}` : '—'}</span>
                <${NumInput} value=${fromKg(s.weight, 2)} placeholder=${p ? fromKg(p.weight || 0) : '0'} onInput=${v => mut(() => { s.weight = toKg(v); })} />
                <${NumInput} decimals=${false} value=${s.reps} placeholder=${p ? p.reps : ex.target || '0'} onInput=${v => mut(() => { s.reps = v; })} />
                <button class="chk" onClick=${() => toggleDone(ei, si)} aria-label="Complete set">${icon('check', 20)}</button>
              </div>`;
            })}
          </div>
          <button class="addset" onClick=${() => mut(() => { const l = ex.sets[ex.sets.length - 1]; ex.sets.push({ weight: l ? l.weight : null, reps: l ? l.reps : null, type: 'normal', done: false }); })}>+ Add set</button>
        </div>`;
      })}
      <button class="btn block primary mt2" onClick=${() => setPick(true)}>${icon('plus', 20)} Add exercise</button>
      <button class="btn block danger mt" onClick=${discard}>Discard workout</button>
    </div>
    ${pick && html`<${ExercisePicker} onClose=${() => setPick(false)} onDone=${ids => {
      mut(() => { ids.forEach(id => w.exercises.push({ exerciseId: id, rest: S.settings.rest, note: '', sets: [{ weight: null, reps: null, type: 'normal', done: false }] })); });
      setPick(false);
    }} />`}
    ${setMenu && html`<${ActionSheet} title="Set type" onClose=${() => setSetMenu(null)} items=${[
      ...Object.keys(TYPE_LABEL).map(t => ({ label: TYPE_LABEL[t], active: w.exercises[setMenu.ei].sets[setMenu.si].type === t, onClick: () => mut(() => { w.exercises[setMenu.ei].sets[setMenu.si].type = t; }) })),
      { label: 'Delete set', danger: true, onClick: () => mut(() => { w.exercises[setMenu.ei].sets.splice(setMenu.si, 1); }) },
    ]} />`}
    ${exMenu != null && html`<${ActionSheet} title=${exById(w.exercises[exMenu].exerciseId).name} onClose=${() => setExMenu(null)} items=${[
      w.exercises[exMenu].superset ? { label: 'Remove superset', onClick: () => superset(exMenu) } : exMenu < w.exercises.length - 1 && { label: 'Superset with next exercise', onClick: () => superset(exMenu) },
      exMenu > 0 && { label: 'Move up', onClick: () => moveEx(exMenu, -1) },
      exMenu < w.exercises.length - 1 && { label: 'Move down', onClick: () => moveEx(exMenu, 1) },
      { label: 'Remove exercise', danger: true, onClick: () => mut(() => { w.exercises.splice(exMenu, 1); }) },
    ]} />`}
    ${restPick != null && html`<${ActionSheet} title="Rest timer for this exercise" onClose=${() => setRestPick(null)}
      items=${REST_OPTS.map(o => ({ label: restLabel(o), active: (w.exercises[restPick].rest != null ? w.exercises[restPick].rest : S.settings.rest) === o, onClick: () => mut(() => { w.exercises[restPick].rest = o; }) }))} />`}
  </div>`;
}

export function WorkoutSummary() {
  const { w, prs } = UI.summary;
  return html`<${Sheet} title="Workout complete" onClose=${() => ui(u => { u.summary = null; })}>
    <div class="center" style="color:var(--yellow)">${icon('trophy', 56)}</div>
    <div class="center h1 mt" style="display:block">${w.name}</div>
    <div class="card grid3">
      <div class="stat"><div class="n">${fmtDur(w.end - w.start)}</div><div class="l">Duration</div></div>
      <div class="stat"><div class="n">${num(fromKg(workoutVolume(w), 0))}</div><div class="l">Volume (${wUnit()})</div></div>
      <div class="stat"><div class="n">${workoutSets(w)}</div><div class="l">Sets</div></div>
    </div>
    ${prs.length > 0 && html`<div class="card"><div class="card-title">${prs.length} personal record${prs.length > 1 ? 's' : ''}</div>${prs.map(p => html`<div class="mt"><span class="tag pr">PR</span> ${p}</div>`)}</div>`}
    <div class="muted small center">This is workout number ${S.workouts.length}. Keep it up.</div>
    <button class="btn block primary mt2" onClick=${() => ui(u => { u.summary = null; })}>Done</button>
  <//>`;
}

/* ---------- tab ---------- */
export function WorkoutTab() {
  const [edit, setEdit] = useState(null), [dayPick, setDayPick] = useState(null), [menu, setMenu] = useState(null), [tpl, setTpl] = useState(false), [detail, setDetail] = useState(null), [showAll, setShowAll] = useState(false);
  const ti = dayIdx(), todayR = S.routines.find(r => r.id === S.schedule[ti]);
  const doneToday = S.workouts.some(w => today(new Date(w.start)) === today());
  const hist = S.workouts.slice().reverse();
  const applySplit = sp => {
    if (S.schedule.some(Boolean) && !confirm('This replaces your current weekly schedule and adds the routines for this split. Continue?')) return;
    mut(s => {
      const ids = sp.routines.map(r => { const id = uid(); s.routines.push({ id, name: r.name, exercises: JSON.parse(JSON.stringify(r.exercises)) }); return id; });
      s.schedule = sp.schedule.map(i => (i == null ? null : ids[i]));
    });
    setTpl(false); toast(sp.name + ' schedule set');
  };
  return html`<div class="screen">
    <div class="h1">Workout</div>
    <div class="card">
      <div class="muted small">${DAYS_FULL[ti]}${doneToday ? ' · workout logged' : ''}</div>
      <div class="card-title" style="font-size:20px;margin:2px 0 12px">${todayR ? todayR.name : S.schedule.some(Boolean) ? 'Rest day' : 'No schedule yet'}</div>
      <div class="row">
        ${todayR && html`<button class="btn primary grow" onClick=${() => startWorkout(todayR)}>${S.active ? 'Resume workout' : 'Start ' + todayR.name}</button>`}
        <button class=${'btn grow' + (todayR ? '' : ' primary')} onClick=${() => startWorkout(null)}>${S.active && !todayR ? 'Resume workout' : 'Empty workout'}</button>
      </div>
    </div>

    <div class="h2"><span>Weekly schedule</span><button onClick=${() => setTpl(true)}>Split templates</button></div>
    <div class="list">${DAYS_FULL.map((d, i) => {
      const r = S.routines.find(x => x.id === S.schedule[i]);
      return html`<button class="item tap" onClick=${() => setDayPick(i)}>
        <div class="grow title" style=${i === ti ? 'color:var(--accent);font-weight:700' : ''}>${d}</div>
        <div class="val" style=${r ? 'color:var(--text)' : ''}>${r ? r.name : 'Rest'}</div><span class="muted">${icon('right', 16)}</span>
      </button>`;
    })}</div>

    <div class="h2"><span>Routines (${S.routines.length})</span><button onClick=${() => setEdit({ id: uid(), name: '', exercises: [] })}>+ New</button></div>
    ${!S.routines.length && html`<div class="card empty">No routines yet. Create one, or pick a split template to get a full week set up in one tap.</div>`}
    ${S.routines.map(r => html`<div class="card">
      <div class="row between"><div class="card-title grow ellip">${r.name}</div><button class="icon-btn" onClick=${() => setMenu(r)} aria-label="Routine options">${icon('more')}</button></div>
      <div class="muted small" style="margin:2px 0 12px">${r.exercises.map(e => exById(e.exerciseId).name).join(', ')}</div>
      <button class="btn primary block sm" onClick=${() => startWorkout(r)}>Start routine</button>
    </div>`)}

    <div class="h2"><span>History</span>${hist.length > 5 && html`<button onClick=${() => setShowAll(!showAll)}>${showAll ? 'Show less' : 'Show all'}</button>`}</div>
    ${!hist.length && html`<div class="card empty">Finished workouts show up here.</div>`}
    ${hist.length > 0 && html`<div class="list">${hist.slice(0, showAll ? 500 : 5).map(w => html`<button class="item tap" onClick=${() => setDetail(w)}>
      <div class="grow"><div class="title ellip">${w.name} ${w.source === 'strava' && html`<span class="tag strava">STRAVA</span>`}</div><div class="sub">${fmtDate(w.start, { weekday: 'short', month: 'short', day: 'numeric' })} · ${w.source === 'strava' ? stravaLine(w) : `${fmtDur(w.end - w.start)} · ${workoutSets(w)} sets · ${num(fromKg(workoutVolume(w), 0))} ${wUnit()}`}</div></div>
      <span class="muted">${icon('right', 16)}</span>
    </button>`)}</div>`}
  </div>
    ${edit && html`<${RoutineEditor} routine=${edit} onClose=${() => setEdit(null)} />`}
    ${detail && html`<${WorkoutDetail} w=${detail} onClose=${() => setDetail(null)} />`}
    ${dayPick != null && html`<${ActionSheet} title=${DAYS_FULL[dayPick]} onClose=${() => setDayPick(null)} items=${[
      ...S.routines.map(r => ({ label: r.name, active: S.schedule[dayPick] === r.id, onClick: () => mut(s => { s.schedule[dayPick] = r.id; }) })),
      { label: 'Rest day', active: !S.schedule[dayPick], onClick: () => mut(s => { s.schedule[dayPick] = null; }) },
    ]} />`}
    ${menu && html`<${ActionSheet} title=${menu.name} onClose=${() => setMenu(null)} items=${[
      { label: 'Edit routine', onClick: () => setEdit(menu) },
      { label: 'Duplicate', onClick: () => mut(s => { s.routines.push({ ...JSON.parse(JSON.stringify(menu)), id: uid(), name: menu.name + ' copy' }); }) },
      { label: 'Delete routine', danger: true, onClick: () => { if (confirm(`Delete "${menu.name}"?`)) mut(s => { s.routines = s.routines.filter(r => r.id !== menu.id); s.schedule = s.schedule.map(x => (x === menu.id ? null : x)); }); } },
    ]} />`}
    ${tpl && html`<${Sheet} title="Split templates" onClose=${() => setTpl(false)}>
      <div class="muted small" style="margin-bottom:12px">Pick a split to create its routines and fill in your week. You can edit everything afterwards.</div>
      ${SPLITS.map(sp => html`<button class="opt" onClick=${() => applySplit(sp)}><div class="t">${sp.name}</div><div class="s">${sp.desc}</div></button>`)}
    <//>`}`;
}
