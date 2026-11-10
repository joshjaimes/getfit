// Profile tab: goals and calculated targets, settings, backup. Also the first-run setup.
import { html, useState, useRef, Sheet, NumInput, Seg, Field } from './ui.js';
import { S, mut, toast, exportData, importData, resetAll } from './store.js';
import { targets, ACTIVITY, RATES, fromKg, toKg, wUnit, isImp, round, num, today, LB } from './calc.js';

const GOALS = [['cut', 'Cut', 'Lose fat'], ['maintain', 'Maintain', 'Stay the same'], ['bulk', 'Bulk', 'Build muscle']];

function StatsForm({ p, set }) {
  const imp = isImp(), totalIn = p.heightCm / 2.54, ft = Math.floor(Math.round(totalIn) / 12), inch = Math.round(totalIn) % 12;
  const rates = RATES[p.goal];
  return html`
    <${Field} label="Units"><${Seg} options=${[['imperial', 'lb / ft-in'], ['metric', 'kg / cm']]} value=${S.settings.units} onChange=${v => mut(s => { s.settings.units = v; })} /><//>
    <${Field} label="Sex (used for the calorie formula)"><${Seg} options=${[['male', 'Male'], ['female', 'Female']]} value=${p.sex} onChange=${v => set({ sex: v })} /><//>
    <div class="grid2">
      <${Field} label="Age"><${NumInput} decimals=${false} value=${p.age} onInput=${v => set({ age: v || 0 })} /><//>
      <${Field} label=${`Current weight (${wUnit()})`}><${NumInput} value=${fromKg(p.weightKg, 1)} onInput=${v => set({ weightKg: toKg(v) || 0 })} /><//>
    </div>
    ${imp ? html`<div class="grid2">
      <${Field} label="Height (ft)"><${NumInput} decimals=${false} value=${ft} onInput=${v => set({ heightCm: ((v || 0) * 12 + inch) * 2.54 })} /><//>
      <${Field} label="Height (in)"><${NumInput} decimals=${false} value=${inch} onInput=${v => set({ heightCm: (ft * 12 + Math.min(11, v || 0)) * 2.54 })} /><//>
    </div>` : html`<${Field} label="Height (cm)"><${NumInput} value=${round(p.heightCm, 0)} onInput=${v => set({ heightCm: v || 0 })} /><//>`}
    <div class="field-label">Activity level</div>
    ${ACTIVITY.map(([v, t, s]) => html`<button class=${'opt' + (p.activity === v ? ' on' : '')} onClick=${() => set({ activity: v })}><div class="t">${t}</div><div class="s">${s}</div></button>`)}
    <div class="field-label" style="margin-top:14px">Goal</div>
    <div class="grid3" style="margin-bottom:8px">${GOALS.map(([v, t, s]) => html`<button class=${'opt center' + (p.goal === v ? ' on' : '')} style="text-align:center;margin:0" onClick=${() => set({ goal: v, rate: v === 'cut' ? 1 : v === 'bulk' ? 0.5 : 0 })}><div class="t">${t}</div><div class="s">${s}</div></button>`)}</div>
    ${rates.length > 0 && html`<${Field} label=${p.goal === 'cut' ? 'How fast do you want to lose?' : 'How fast do you want to gain?'}
      hint=${p.goal === 'cut' ? '0.5-1 lb a week keeps the most muscle. 2 lb a week is aggressive.' : '0.25-0.5 lb a week keeps fat gain low.'}>
      <${Seg} options=${rates.map(r => [r, imp ? `${r} lb/wk` : `${round(r / LB, 2)} kg/wk`])} value=${p.rate} onChange=${v => set({ rate: v })} /><//>`}`;
}
const valid = p => p.age >= 13 && p.age <= 100 && p.weightKg >= 30 && p.weightKg <= 320 && p.heightCm >= 120 && p.heightCm <= 230;

function TargetsCard({ t }) {
  return html`<div class="card">
    <div class="grid4">
      <div class="stat"><div class="n">${num(t.calories)}</div><div class="l">Calories</div></div>
      <div class="stat"><div class="n" style="color:var(--teal)">${t.protein}g</div><div class="l">Protein</div></div>
      <div class="stat"><div class="n" style="color:var(--yellow)">${t.carbs}g</div><div class="l">Carbs</div></div>
      <div class="stat"><div class="n" style="color:var(--orange)">${t.fat}g</div><div class="l">Fat</div></div>
    </div>
  </div>`;
}
function Explain({ p, t }) {
  const perLb = round(t.gkg / LB, 2);
  return html`<div class="card small">
    <div class="row between"><span class="muted">Calories your body burns at rest (BMR)</span><b>${num(t.bmr)}</b></div>
    <div class="row between mt"><span class="muted">Maintenance with your activity</span><b>${num(t.tdee)}</b></div>
    <div class="row between mt"><span class="muted">${p.goal === 'cut' ? `Deficit to lose ${p.rate} lb/week` : p.goal === 'bulk' ? `Surplus to gain ${p.rate} lb/week` : 'Adjustment'}</span><b>${t.delta > 0 ? '+' : ''}${num(t.delta)}</b></div>
    <div class="row between mt"><span class="muted">Daily calorie target</span><b class="accent">${num(t.auto.calories)}</b></div>
    <div class="row between mt"><span class="muted">Protein (${isImp() ? perLb + ' g per lb' : t.gkg + ' g per kg'} for a ${p.goal === 'maintain' ? 'maintenance' : p.goal})</span><b class="accent">${t.auto.protein}g</b></div>
    ${t.bmi > 30 && html`<div class="muted mt">Because of your height-to-weight ratio, protein is based on an adjusted bodyweight so the target stays realistic.</div>`}
    ${t.floored && html`<div class="note mt">That pace would put you under ${t.floor} calories a day, so the target is held at ${t.floor}. Consider a slower rate.</div>`}
    ${p.custom && html`<div class="note mt">You are using custom targets, shown above. These calculated numbers are for reference.</div>`}
  </div>`;
}

export function Onboarding() {
  const [p, setP] = useState({ ...S.profile });
  const t = targets({ ...p, custom: null }), ok = valid(p);
  const done = () => mut(s => { s.profile = { ...p, custom: null, onboarded: true }; if (!s.weights.length) s.weights.push({ date: today(), kg: p.weightKg }); });
  return html`<div class="screen" style="padding-bottom:calc(var(--sb) + 40px)"><div class="onb">
    <div class="logo">GetFit</div>
    <div class="muted" style="margin-bottom:22px">Workouts and nutrition in one place. A few details set your calorie and protein targets — you can change them any time.</div>
    <${StatsForm} p=${p} set=${patch => setP({ ...p, ...patch })} />
    <div class="h2"><span>Your daily targets</span></div>
    ${ok ? html`<${TargetsCard} t=${t} /><${Explain} p=${p} t=${t} />` : html`<div class="card empty">Enter your age, weight and height to see your targets.</div>`}
    <button class="btn primary block" disabled=${!ok} onClick=${done}>Get started</button>
    <div class="muted small center mt">These are estimates for healthy adults, not medical advice.</div>
  </div></div>`;
}

export function ProfileTab() {
  const [edit, setEdit] = useState(null), [custom, setCustom] = useState(null);
  const fileRef = useRef(null);
  const p = S.profile, t = targets();
  const doExport = async () => {
    const text = await exportData(), name = `getfit-backup-${today()}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const doImport = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file || !confirm('Restoring replaces everything currently in the app with the backup. Continue?')) return;
    try { await importData(await file.text()); toast('Backup restored'); } catch (err) { toast(err.message || 'Could not read that file'); }
  };
  const act = ACTIVITY.find(a => a[0] === p.activity);
  return html`<div class="screen">
    <div class="h1">Profile</div>
    <div class="h2"><span>Daily targets${p.custom ? ' (custom)' : ''}</span><button onClick=${() => setCustom({ ...(p.custom || t.auto) })}>Customize</button></div>
    <${TargetsCard} t=${t} />
    <${Explain} p=${p} t=${t} />

    <div class="h2"><span>You and your goal</span><button onClick=${() => setEdit({ ...p })}>Edit</button></div>
    <div class="list">
      <div class="item"><div class="grow">Goal</div><div class="val">${GOALS.find(g => g[0] === p.goal)[1]}${p.goal !== 'maintain' ? ` · ${p.rate} lb/week` : ''}</div></div>
      <div class="item"><div class="grow">Weight</div><div class="val">${fromKg(p.weightKg, 1)} ${wUnit()}</div></div>
      <div class="item"><div class="grow">Height</div><div class="val">${isImp() ? `${Math.floor(Math.round(p.heightCm / 2.54) / 12)} ft ${Math.round(p.heightCm / 2.54) % 12} in` : round(p.heightCm, 0) + ' cm'}</div></div>
      <div class="item"><div class="grow">Age · Sex</div><div class="val">${p.age} · ${p.sex === 'male' ? 'Male' : 'Female'}</div></div>
      <div class="item"><div class="grow">Activity</div><div class="val">${act ? act[1] : ''}</div></div>
    </div>

    <div class="h2"><span>Settings</span></div>
    <div class="card">
      <${Field} label="Units"><${Seg} options=${[['imperial', 'lb / ft-in'], ['metric', 'kg / cm']]} value=${S.settings.units} onChange=${v => mut(s => { s.settings.units = v; })} /><//>
      <${Field} label="Default rest timer"><select value=${S.settings.rest} onChange=${e => mut(s => { s.settings.rest = +e.target.value; })}>${[0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map(o => html`<option value=${o}>${o ? (o % 60 ? o + ' sec' : o / 60 + ' min') : 'Off'}</option>`)}</select><//>
      <${Field} label="USDA food search key (optional)" hint="Food search works without this, but only a few searches per hour. A free key from fdc.nal.usda.gov/api-key-signup removes that limit. Barcode scanning never needs it.">
        <input value=${S.settings.usdaKey || ''} onInput=${e => mut(s => { s.settings.usdaKey = e.target.value.trim(); })} placeholder="Paste key here" autocapitalize="off" autocorrect="off" /><//>
    </div>

    <div class="h2"><span>Your data</span></div>
    <div class="card">
      <div class="muted small" style="margin-bottom:12px">Everything is stored on this phone only. Save a backup now and then so you can restore it on a new phone.</div>
      <div class="grid2"><button class="btn" onClick=${doExport}>Save backup</button><button class="btn" onClick=${() => fileRef.current.click()}>Restore backup</button></div>
      <input ref=${fileRef} type="file" accept=".json,application/json" style="display:none" onChange=${doImport} />
      <button class="btn block danger mt" onClick=${async () => { if (confirm('Erase ALL workouts, food logs, photos and settings? This cannot be undone.') && confirm('Really erase everything?')) await resetAll(); }}>Erase all data</button>
    </div>
    <div class="muted small center">GetFit · Food data from Open Food Facts</div>
  </div>
  ${edit && html`<${Sheet} full title="You and your goal" onClose=${() => setEdit(null)} action=${html`<button onClick=${() => { if (!valid(edit)) return toast('Check your age, weight and height'); mut(s => { s.profile = { ...edit, custom: s.profile.custom, onboarded: true }; }); setEdit(null); }}>Save</button>`}>
    <${StatsForm} p=${edit} set=${patch => setEdit({ ...edit, ...patch })} />
  <//>`}
  ${custom && html`<${Sheet} title="Custom targets" onClose=${() => setCustom(null)} action=${html`<button onClick=${() => { mut(s => { s.profile.custom = { calories: custom.calories || 0, protein: custom.protein || 0, carbs: custom.carbs || 0, fat: custom.fat || 0 }; }); setCustom(null); }}>Save</button>`}>
    <div class="grid2">
      <${Field} label="Calories"><${NumInput} decimals=${false} value=${custom.calories} onInput=${v => setCustom({ ...custom, calories: v })} /><//>
      <${Field} label="Protein (g)"><${NumInput} decimals=${false} value=${custom.protein} onInput=${v => setCustom({ ...custom, protein: v })} /><//>
      <${Field} label="Carbs (g)"><${NumInput} decimals=${false} value=${custom.carbs} onInput=${v => setCustom({ ...custom, carbs: v })} /><//>
      <${Field} label="Fat (g)"><${NumInput} decimals=${false} value=${custom.fat} onInput=${v => setCustom({ ...custom, fat: v })} /><//>
    </div>
    <div class="hint" style="margin-bottom:14px">Macros add up to ${num((custom.protein || 0) * 4 + (custom.carbs || 0) * 4 + (custom.fat || 0) * 9)} calories.</div>
    <button class="btn block" onClick=${() => { mut(s => { s.profile.custom = null; }); setCustom(null); toast('Using calculated targets'); }}>Use calculated targets instead</button>
  <//>`}`;
}
