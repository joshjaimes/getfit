// Calendar: a month grid marking every day that has saved data, and a day view of what was saved.
import { html, useState, Sheet, icon } from './ui.js';
import { S, ui } from './store.js';
import { MEALS } from './data.js';
import { today, fmtDate, fmtDur, fromKg, fromCm, wUnit, lUnit, num, round, targets, sumEntries, workoutVolume, workoutSets, DAYS } from './calc.js';
import { WorkoutDetail, exById } from './workout.js';
import { stravaLine } from './strava.js';
import { Photo } from './progress.js';

const pad = n => String(n).padStart(2, '0');

/** date string -> everything saved on that day */
function buildIndex() {
  const ix = {};
  const g = d => ix[d] || (ix[d] = { workouts: [], entries: [], photos: [], weight: null, measures: null });
  S.workouts.forEach(w => g(today(new Date(w.start))).workouts.push(w));
  S.entries.forEach(e => g(e.date).entries.push(e));
  S.photos.forEach(p => g(p.date).photos.push(p));
  S.weights.forEach(x => { g(x.date).weight = x.kg; });
  S.measures.forEach(x => { g(x.date).measures = x.vals; });
  return ix;
}
const hasData = d => d && (d.workouts.length || d.entries.length || d.photos.length || d.weight != null || d.measures);

function DaySheet({ date, day, onClose }) {
  const [detail, setDetail] = useState(null), [photo, setPhoto] = useState(null);
  const d = day || { workouts: [], entries: [], photos: [], weight: null, measures: null };
  const t = targets(), tot = sumEntries(d.entries);
  const openDiary = () => ui(u => { u.tab = 'food'; u.foodDate = date; });
  return html`<${Sheet} full title=${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} onClose=${onClose}>
    ${!hasData(d) && html`<div class="card empty">Nothing was saved on this day.</div>`}

    <div class="h2"><span>Workout</span></div>
    ${!d.workouts.length ? html`<div class="card empty">No workout logged.</div>` : d.workouts.map(w => html`<button class="card tap" style="display:block;width:100%;text-align:left" onClick=${() => setDetail(w)}>
      <div class="row between"><div class="card-title grow ellip">${w.name} ${w.source === 'strava' && html`<span class="tag strava">STRAVA</span>`}</div><span class="muted">${icon('right', 16)}</span></div>
      <div class="muted small" style="margin-top:2px">${w.source === 'strava' ? stravaLine(w) : `${fmtDur(w.end - w.start)} · ${workoutSets(w)} sets · ${num(fromKg(workoutVolume(w), 0))} ${wUnit()}`}</div>
      ${w.exercises.map(e => {
        const sets = e.sets.filter(s => s.done), best = sets.reduce((a, s) => ((s.weight || 0) > (a.weight || 0) || !a ? s : a), sets[0]);
        return best && html`<div class="row between small" style="margin-top:8px"><span class="ellip">${sets.length} × ${exById(e.exerciseId).name}</span><span class="muted" style="white-space:nowrap">${fromKg(best.weight || 0)} ${wUnit()} × ${best.reps}</span></div>`;
      })}
    </button>`)}

    <div class="h2"><span>Meals</span><button onClick=${openDiary}>${d.entries.length ? 'Open in diary' : 'Log food'}</button></div>
    ${!d.entries.length ? html`<div class="card empty">No food logged.</div>` : html`
      <div class="nutri">
        <div><div class="n">${num(tot.kcal)}</div><div class="l">of ${num(t.calories)} cal</div></div>
        <div><div class="n" style="color:var(--teal)">${Math.round(tot.p)}g</div><div class="l">Protein</div></div>
        <div><div class="n" style="color:var(--yellow)">${Math.round(tot.c)}g</div><div class="l">Carbs</div></div>
        <div><div class="n" style="color:var(--orange)">${Math.round(tot.f)}g</div><div class="l">Fat</div></div>
      </div>
      ${MEALS.map((m, mi) => {
        const es = d.entries.filter(e => e.meal === mi);
        return es.length > 0 && html`<div class="list">
          <div class="meal-head"><div class="t">${m}</div><div class="k">${Math.round(sumEntries(es).kcal)} cal</div></div>
          ${es.map(e => html`<div class="item"><div class="grow"><div class="title ellip">${e.food.name}</div><div class="sub ellip">${e.food.quick ? 'Quick add' : `${round(e.qty, 2)} × ${e.food.serving}`}</div></div><div class="val">${Math.round(e.food.kcal * e.qty)}</div></div>`)}
        </div>`;
      })}`}

    <div class="h2"><span>Progress photos</span></div>
    ${!d.photos.length ? html`<div class="card empty">No photo taken.</div>` : html`<div class="photos">${d.photos.map(p => html`<button class="ph" onClick=${() => setPhoto(p)}><${Photo} id=${p.id} /></button>`)}</div>`}

    ${(d.weight != null || d.measures) && html`<div class="h2"><span>Body</span></div><div class="list">
      ${d.weight != null && html`<div class="item"><div class="grow">Weight</div><b>${fromKg(d.weight, 1)} ${wUnit()}</b></div>`}
      ${d.measures && Object.keys(d.measures).map(k => html`<div class="item"><div class="grow">${k === 'Body fat %' ? 'Body fat' : k}</div><b>${k === 'Body fat %' ? round(d.measures[k], 1) + '%' : fromCm(d.measures[k], 1) + ' ' + lUnit()}</b></div>`)}
    </div>`}

    ${detail && html`<${WorkoutDetail} w=${detail} onClose=${() => setDetail(null)} />`}
    ${photo && html`<${Sheet} full title="Progress photo" onClose=${() => setPhoto(null)}><div class="bigphoto"><${Photo} id=${photo.id} /></div><//>`}
  <//>`;
}

export function Calendar() {
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()]), [sel, setSel] = useState(null);
  const [y, m] = ym, ix = buildIndex(), tday = today();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const cells = Array(lead).fill(null).concat(Array.from({ length: dim }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`));
  const inMonth = cells.filter(Boolean).map(d => ix[d]).filter(hasData);
  const move = n => { const d = new Date(y, m + n, 1); setYm([d.getFullYear(), d.getMonth()]); };
  const isNow = y === now.getFullYear() && m === now.getMonth();
  return html`
    <div class="card">
      <div class="row between" style="margin-bottom:10px">
        <button class="icon-btn" onClick=${() => move(-1)} aria-label="Previous month">${icon('left')}</button>
        <button class="card-title" onClick=${() => setYm([now.getFullYear(), now.getMonth()])}>${new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</button>
        <button class="icon-btn" onClick=${() => move(1)} aria-label="Next month">${icon('right')}</button>
      </div>
      <div class="cal cal-head">${DAYS.map(d => html`<div>${d[0]}</div>`)}</div>
      <div class="cal">${cells.map(date => {
        if (!date) return html`<div></div>`;
        const d = ix[date], w = d && d.workouts.length > 0, strava = w && d.workouts.every(x => x.source === 'strava');
        return html`<button class=${'cal-day' + (date === tday ? ' today' : '') + (date > tday ? ' future' : '') + (hasData(d) ? ' has' : '')} onClick=${() => setSel(date)} aria-label=${fmtDate(date, { month: 'long', day: 'numeric' })}>
          <span class=${'cal-num' + (w ? (strava ? ' strava' : ' workout') : '')}>${+date.slice(8)}</span>
          <span class="cal-dots">${d && d.entries.length > 0 && html`<i class="food"></i>`}${d && d.photos.length > 0 && html`<i class="photo"></i>`}${d && (d.weight != null || d.measures) && html`<i class="body"></i>`}</span>
        </button>`;
      })}</div>
      <div class="cal-legend"><span><i class="workout"></i>Workout</span><span><i class="strava"></i>Strava</span><span><i class="food"></i>Meals</span><span><i class="photo"></i>Photo</span><span><i class="body"></i>Weigh-in</span></div>
    </div>
    <div class="card grid3">
      <div class="stat"><div class="n">${inMonth.reduce((a, d) => a + d.workouts.length, 0)}</div><div class="l">Workouts</div></div>
      <div class="stat"><div class="n">${inMonth.filter(d => d.entries.length).length}</div><div class="l">Days food logged</div></div>
      <div class="stat"><div class="n">${inMonth.reduce((a, d) => a + d.photos.length, 0)}</div><div class="l">Photos</div></div>
    </div>
    <div class="muted small center">${isNow ? 'Tap any day to see what you saved.' : 'Tap the month name to jump back to today.'}</div>
    ${sel && html`<${DaySheet} date=${sel} day=${ix[sel]} onClose=${() => setSel(null)} />`}`;
}
