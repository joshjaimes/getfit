// App shell: tabs, home dashboard, and the floating workout bar.
import { html, render, useState, useEffect, Ring, MacroBar, NumInput, icon } from './ui.js';
import { S, UI, load, subscribe, ui, toast } from './store.js';
import { targets, sumEntries, today, addDays, DAYS, dayIdx, weekStart, fromKg, toKg, wUnit, num, fmtDate } from './calc.js';
import { WorkoutTab, ActiveWorkout, WorkoutSummary, RestBar, Elapsed, startWorkout } from './workout.js';
import { FoodTab, COLORS } from './food.js';
import { ProgressTab, logWeight } from './progress.js';
import { ProfileTab, Onboarding } from './profile.js';
import { initStrava } from './strava.js';

function Home() {
  const [w, setW] = useState(null);
  const t = targets(), tot = sumEntries(S.entries.filter(e => e.date === today())), left = t.calories - tot.kcal;
  const ti = dayIdx(), ws = weekStart(), todayR = S.routines.find(r => r.id === S.schedule[ti]);
  const doneDates = new Set(S.workouts.map(x => today(new Date(x.start))));
  const doneToday = doneDates.has(today());
  const lastW = S.weights[S.weights.length - 1];
  const go = tab => ui(u => { u.tab = tab; });
  // streak of consecutive weeks with at least one workout
  let streak = 0;
  for (let k = 0; k < 520; k++) {
    const a = ws.getTime() - k * 7 * 864e5, hit = S.workouts.some(x => x.start >= a - 36e5 && x.start < a + 7 * 864e5 - 36e5);
    if (hit) streak++; else if (k > 0) break;
  }
  return html`<div class="screen">
    <div class="row between">
      <div><div class="muted small">${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="h1">Today</div></div>
      <button class="btn sm" onClick=${() => ui(u => { u.tab = 'progress'; u.progressTab = 'Calendar'; })}>${icon('calendar', 18)} Calendar</button>
    </div>

    <button class="card tap" style="display:block;width:100%;text-align:left" onClick=${() => go('food')}>
      <div class="row" style="gap:18px">
        <${Ring} value=${tot.kcal} max=${t.calories}><div class="big">${num(Math.abs(left))}</div><div class="lbl">${left < 0 ? 'cal over' : 'cal left'}</div><//>
        <div class="grow">
          <${MacroBar} label="Protein" value=${tot.p} max=${t.protein} color=${COLORS.p} />
          <${MacroBar} label="Carbs" value=${tot.c} max=${t.carbs} color=${COLORS.c} />
          <${MacroBar} label="Fat" value=${tot.f} max=${t.fat} color=${COLORS.f} />
        </div>
      </div>
      <div class="muted small mt">${num(tot.kcal)} of ${num(t.calories)} cal eaten · ${Math.max(0, Math.round(t.protein - tot.p))}g protein to go</div>
    </button>

    <div class="card">
      <div class="row between"><div class="muted small">${doneToday ? 'Workout done today' : "Today's workout"}</div>${streak > 1 && html`<span class="tag pr">${streak} week streak</span>`}</div>
      <div class="card-title" style="font-size:20px;margin:2px 0 12px">${S.active ? S.active.name + ' (in progress)' : todayR ? todayR.name : S.schedule.some(Boolean) ? 'Rest day' : 'No schedule yet'}</div>
      ${S.active ? html`<button class="btn primary block" onClick=${() => ui(u => { u.workoutOpen = true; })}>Resume workout</button>`
        : todayR ? html`<button class=${'btn block ' + (doneToday ? '' : 'primary')} onClick=${() => startWorkout(todayR)}>${doneToday ? 'Start again' : 'Start ' + todayR.name}</button>`
        : html`<div class="row"><button class="btn grow" onClick=${() => startWorkout(null)}>Empty workout</button><button class="btn grow" onClick=${() => go('workout')}>${S.schedule.some(Boolean) ? 'See routines' : 'Set up schedule'}</button></div>`}
      <div class="week mt2">${DAYS.map((d, i) => {
        const date = today(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i)), r = S.routines.find(x => x.id === S.schedule[i]), done = doneDates.has(date);
        return html`<div class=${'day' + (i === ti ? ' today' : '') + (done ? ' done' : '') + (!r && !done ? ' rest' : '')}>${d}<b>${done ? '✓' : r ? r.name.slice(0, 5) : '–'}</b></div>`;
      })}</div>
    </div>

    <div class="card">
      <div class="row between"><div><div class="muted small">Weight${lastW ? ' · ' + fmtDate(lastW.date) : ''}</div><div class="card-title" style="font-size:22px">${fromKg(S.profile.weightKg, 1)} ${wUnit()}</div></div>
        <button class="btn sm ghost" onClick=${() => go('progress')}>Trends</button></div>
      <div class="row mt"><${NumInput} class="input grow" placeholder=${`Log today's weight (${wUnit()})`} value=${w} onInput=${setW} />
        <button class="btn primary" disabled=${!w} onClick=${() => { logWeight(toKg(w)); setW(null); toast('Weight logged — targets updated'); }}>Log</button></div>
    </div>
  </div>`;
}

const TABS = [['home', 'Home', 'home'], ['workout', 'Workout', 'dumbbell'], ['food', 'Food', 'food'], ['progress', 'Progress', 'chart'], ['profile', 'Profile', 'user']];
function App() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(x => x + 1)), []);
  if (!S.profile.onboarded) return html`<${Onboarding} />`;
  const tab = UI.tab;
  return html`
    ${tab === 'home' ? html`<${Home} />` : tab === 'workout' ? html`<${WorkoutTab} />` : tab === 'food' ? html`<${FoodTab} />` : tab === 'progress' ? html`<${ProgressTab} />` : html`<${ProfileTab} />`}
    ${S.active && !UI.workoutOpen && html`<button class="minibar" onClick=${() => ui(u => { u.workoutOpen = true; })}>
      ${icon('dumbbell', 20)}<span class="grow ellip" style="text-align:left">${S.active.name}</span><${Elapsed} start=${S.active.start} />
    </button>`}
    <div class="tabbar">${TABS.map(([id, label, ic]) => html`<button class=${tab === id ? 'on' : ''} onClick=${() => ui(u => { u.tab = id; })}>${icon(ic, 24)}${label}</button>`)}</div>
    ${S.active && UI.workoutOpen && html`<${ActiveWorkout} />`}
    <${RestBar} />
    ${UI.summary && html`<${WorkoutSummary} />`}
    ${UI.toast && html`<div class="toast">${UI.toast}</div>`}`;
}

load().then(() => {
  const root = document.getElementById('app');
  root.innerHTML = '';
  render(html`<${App} />`, root);
  initStrava();
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && !local) navigator.serviceWorker.register('sw.js').catch(() => {});
});
