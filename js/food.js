// Food tab: daily diary, food search, scanning, custom foods and saved meals.
import { html, useState, useRef, Sheet, ActionSheet, NumInput, Seg, Field, MacroBar, icon } from './ui.js';
import { S, UI, mut, uid, toast } from './store.js';
import { COMMON_FOODS, MEALS } from './data.js';
import { today, addDays, niceDate, targets, sumEntries, round, num } from './calc.js';
import { BarcodeScanner, lookupBarcode, searchFoods, readLabel } from './scan.js';

const key = f => `${f.name}|${f.brand || ''}|${f.serving}`.toLowerCase();
const blankFood = () => ({ name: '', brand: '', serving: '1 serving', grams: null, kcal: null, p: null, c: null, f: null, fiber: null, sugar: null, sodium: null, barcode: '' });
const sub = f => `${f.brand ? f.brand + ' · ' : ''}${f.serving}`;
export const COLORS = { p: 'var(--teal)', c: 'var(--yellow)', f: 'var(--orange)' };

function recents() {
  const seen = new Set(), out = [];
  for (let i = S.entries.length - 1; i >= 0 && out.length < 40; i--) {
    const f = S.entries[i].food;
    if (f.quick || seen.has(key(f))) continue;
    seen.add(key(f)); out.push(f);
  }
  return out;
}

/* ---------- create / edit a food ---------- */
function FoodForm({ initial, title = 'Create food', note, onSave, onClose }) {
  const [f, setF] = useState({ ...blankFood(), ...initial });
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = () => {
    if (!f.name.trim()) return toast('Give the food a name');
    if (f.kcal == null) return toast('Enter the calories');
    onSave({ ...f, id: f.id || uid(), name: f.name.trim(), serving: (f.serving || '').trim() || '1 serving', kcal: f.kcal, p: f.p || 0, c: f.c || 0, f: f.f || 0 });
  };
  const n = (k, label, dec = true) => html`<${Field} label=${label}><${NumInput} decimals=${dec} value=${f[k]} onInput=${v => set(k, v)} placeholder="0" /><//>`;
  return html`<${Sheet} full title=${title} onClose=${onClose} action=${html`<button onClick=${save}>Save</button>`}>
    ${note && html`<div class="note">${note}</div>`}
    <${Field} label="Name"><input value=${f.name} onInput=${e => set('name', e.target.value)} placeholder="e.g. Protein granola" /><//>
    <${Field} label="Brand (optional)"><input value=${f.brand || ''} onInput=${e => set('brand', e.target.value)} /><//>
    <div class="grid2">
      <${Field} label="Serving size"><input value=${f.serving} onInput=${e => set('serving', e.target.value)} placeholder="1 cup" /><//>
      ${n('grams', 'Serving weight (g)')}
    </div>
    <div class="h2"><span>Per serving</span></div>
    <div class="grid2">${n('kcal', 'Calories', false)}${n('p', 'Protein (g)')}${n('c', 'Carbs (g)')}${n('f', 'Fat (g)')}${n('fiber', 'Fiber (g)')}${n('sugar', 'Sugar (g)')}${n('sodium', 'Sodium (mg)', false)}</div>
    <button class="btn primary block" onClick=${save}>Save food</button>
  <//>`;
}

/* ---------- pick an amount and log it ---------- */
function FoodDetail({ food, entry, date, meal, onClose, onDone }) {
  const [amt, setAmt] = useState(entry ? round(entry.qty, 2) : 1), [unit, setUnit] = useState('serv'), [m, setM] = useState(entry ? entry.meal : meal);
  const qty = (amt || 0) / (unit === 'g' ? food.grams : 1);
  const v = k => food[k] * qty;
  const save = () => {
    if (!qty) return toast('Enter an amount');
    mut(s => {
      if (entry) { const e = s.entries.find(x => x.id === entry.id); e.qty = qty; e.meal = m; } else s.entries.push({ id: uid(), date, meal: m, food: { ...food }, qty });
    });
    toast(entry ? 'Updated' : `Added to ${MEALS[m]}`); onDone();
  };
  return html`<${Sheet} title=${entry ? 'Edit entry' : 'Add food'} onClose=${onClose} action=${html`<button onClick=${save}>${entry ? 'Save' : 'Add'}</button>`}>
    <div class="card-title" style="font-size:20px">${food.name}</div>
    <div class="muted small" style="margin-bottom:14px">${sub(food)}${food.grams && !/\bg\b/.test(food.serving) ? ` (${food.grams} g)` : ''}</div>
    <div class="nutri">
      <div><div class="n">${Math.round(v('kcal'))}</div><div class="l">Calories</div></div>
      <div><div class="n" style=${'color:' + COLORS.p}>${round(v('p'), 1)}g</div><div class="l">Protein</div></div>
      <div><div class="n" style=${'color:' + COLORS.c}>${round(v('c'), 1)}g</div><div class="l">Carbs</div></div>
      <div><div class="n" style=${'color:' + COLORS.f}>${round(v('f'), 1)}g</div><div class="l">Fat</div></div>
    </div>
    <div class="grid2">
      <${Field} label="Amount"><${NumInput} value=${amt} onInput=${setAmt} /><//>
      <${Field} label="Unit"><select value=${unit} onChange=${e => { const u = e.target.value; if (u !== unit && food.grams) setAmt(u === 'g' ? round((amt || 0) * food.grams, 0) : round((amt || 0) / food.grams, 2)); setUnit(u); }}>
        <option value="serv">× ${food.serving}</option>${food.grams && html`<option value="g">grams</option>`}</select><//>
    </div>
    <${Field} label="Meal"><select value=${m} onChange=${e => setM(+e.target.value)}>${MEALS.map((x, i) => html`<option value=${i}>${x}</option>`)}</select><//>
    <button class="btn primary block" onClick=${save}>${entry ? 'Save changes' : `Add to ${MEALS[m]}`}</button>
    ${entry && html`<button class="btn block danger mt" onClick=${() => { mut(s => { s.entries = s.entries.filter(x => x.id !== entry.id); }); onDone(); }}>Delete entry</button>`}
  <//>`;
}

function QuickAdd({ date, meal, onClose }) {
  const [f, setF] = useState({ name: '', kcal: null, p: null, c: null, f: null });
  const save = () => {
    if (f.kcal == null && f.p == null && f.c == null && f.f == null) return toast('Enter calories or macros');
    const kcal = f.kcal != null ? f.kcal : Math.round((f.p || 0) * 4 + (f.c || 0) * 4 + (f.f || 0) * 9);
    mut(s => { s.entries.push({ id: uid(), date, meal, qty: 1, food: { id: uid(), quick: true, name: f.name.trim() || 'Quick add', serving: '1 entry', kcal, p: f.p || 0, c: f.c || 0, f: f.f || 0 } }); });
    toast(`Added to ${MEALS[meal]}`); onClose(true);
  };
  const n = (k, label) => html`<${Field} label=${label}><${NumInput} value=${f[k]} onInput=${v => setF({ ...f, [k]: v })} placeholder="0" /><//>`;
  return html`<${Sheet} title="Quick add" onClose=${() => onClose(false)} action=${html`<button onClick=${save}>Add</button>`}>
    <${Field} label="Description (optional)"><input value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })} placeholder="e.g. Dinner out" /><//>
    <div class="grid2">${n('kcal', 'Calories')}${n('p', 'Protein (g)')}${n('c', 'Carbs (g)')}${n('f', 'Fat (g)')}</div>
    <div class="hint" style="margin-bottom:14px">Leave calories empty to work them out from the macros.</div>
    <button class="btn primary block" onClick=${save}>Add to ${MEALS[meal]}</button>
  <//>`;
}

/* ---------- add food screen ---------- */
function AddFood({ date, meal, onClose }) {
  const [q, setQ] = useState(''), [tab, setTab] = useState('Recent'), [online, setOnline] = useState(null), [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null), [form, setForm] = useState(null), [scan, setScan] = useState(false), [quick, setQuick] = useState(false), [busy, setBusy] = useState('');
  const fileRef = useRef(null);

  const ql = q.trim().toLowerCase();
  const rec = recents();
  let local;
  if (ql) {
    const seen = new Set();
    local = S.myFoods.concat(rec, COMMON_FOODS).filter(f => { const k = key(f); if (seen.has(k) || !(f.name + ' ' + (f.brand || '')).toLowerCase().includes(ql)) return false; seen.add(k); return true; });
  } else local = tab === 'Recent' ? (rec.length ? rec : COMMON_FOODS) : tab === 'My foods' ? S.myFoods : [];

  const doSearch = async () => {
    if (!ql) return;
    setLoading(true); setOnline(null);
    try { setOnline(await searchFoods(ql)); } catch (e) { toast(e.message); setOnline([]); }
    setLoading(false);
  };
  const onCode = async code => {
    setScan(false); setBusy('Looking up barcode…');
    try {
      const mine = S.myFoods.find(f => f.barcode === code);
      const f = mine || await lookupBarcode(code);
      setBusy('');
      if (f) setDetail(f);
      else setForm({ food: { barcode: code }, note: `Barcode ${code} is not in the database yet. Enter it once (or scan the label) and it will be saved to My foods.` });
    } catch (e) { setBusy(''); toast(e.message); }
  };
  const onLabel = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const keep = form && form.food ? form.food : {};
    setBusy('Reading label…');
    try {
      const r = await readLabel(file, p => setBusy(`Reading label… ${Math.round(p * 100)}%`));
      const { text, ...parsed } = r;
      const got = ['kcal', 'p', 'c', 'f'].filter(k => parsed[k] != null).length;
      setForm({ k: Date.now(), food: { ...parsed, name: keep.name || '', brand: keep.brand || '', barcode: keep.barcode || '' }, note: got >= 3 ? 'Label read. Double-check the numbers against the package before saving.' : got ? 'Only part of the label could be read. Fill in the missing numbers.' : 'The label could not be read. Try a sharper, straight-on photo with good light, or type the numbers in.' });
    } catch (err) { toast('Label reading failed. Check your connection and try again.'); }
    setBusy('');
  };
  const addMeal = sm => { mut(s => { sm.items.forEach(it => s.entries.push({ id: uid(), date, meal, food: { ...it.food }, qty: it.qty })); }); toast(`${sm.name} added to ${MEALS[meal]}`); onClose(); };
  const row = f => html`<button class="item tap" onClick=${() => setDetail(f)}>
    <div class="grow"><div class="title ellip">${f.name}</div><div class="sub ellip">${sub(f)}</div></div>
    <div class="val">${Math.round(f.kcal)} cal</div><span class="accent">${icon('plus', 20)}</span>
  </button>`;

  return html`<${Sheet} full title=${'Add to ' + MEALS[meal]} onClose=${onClose}>
    <form class="search" onSubmit=${e => { e.preventDefault(); doSearch(); e.target.querySelector('input').blur(); }}>
      ${icon('search', 20)}<input class="input" type="search" enterkeyhint="search" placeholder="Search foods" value=${q} onInput=${e => { setQ(e.target.value); setOnline(null); }} />
    </form>
    <div class="quick">
      <button onClick=${() => setScan(true)}>${icon('barcode', 26)}Scan barcode</button>
      <button onClick=${() => fileRef.current.click()}>${icon('camera', 26)}Scan label</button>
      <button onClick=${() => setQuick(true)}>${icon('bolt', 26)}Quick add</button>
      <button onClick=${() => setForm({ food: {} })}>${icon('plus', 26)}Create food</button>
    </div>
    <input ref=${fileRef} type="file" accept="image/*" capture="environment" style="display:none" onChange=${onLabel} />
    ${!ql && html`<${Seg} options=${['Recent', 'My foods', 'Meals']} value=${tab} onChange=${setTab} />`}
    ${!ql && tab === 'Recent' && !rec.length && html`<div class="muted small" style="margin:0 4px 8px">Common foods — the foods you log will appear here.</div>`}
    ${!ql && tab === 'Meals' ? html`
      ${!S.meals.length && html`<div class="card empty">No saved meals yet. Log a meal, then use the ••• button on it in your diary and choose “Save as meal”.</div>`}
      ${S.meals.length > 0 && html`<div class="list">${S.meals.map(sm => { const t = sumEntries(sm.items); return html`<div class="item">
        <button class="grow" style="text-align:left" onClick=${() => addMeal(sm)}><div class="title">${sm.name}</div><div class="sub">${sm.items.length} items · ${Math.round(t.kcal)} cal · ${Math.round(t.p)}g protein</div></button>
        <button class="icon-btn muted" aria-label="Delete meal" onClick=${() => { if (confirm(`Delete saved meal "${sm.name}"?`)) mut(s => { s.meals = s.meals.filter(x => x.id !== sm.id); }); }}>${icon('trash', 20)}</button>
      </div>`; })}</div>`}` : html`
      ${local.length > 0 && html`<div class="list">${local.slice(0, 60).map(row)}</div>`}
      ${!ql && tab === 'My foods' && !local.length && html`<div class="card empty">Foods you create or scan from a label are saved here.</div>`}
      ${ql && !local.length && !online && !loading && html`<div class="empty">No matches in your foods.</div>`}`}
    ${ql && !online && html`<button class="btn block" disabled=${loading} onClick=${doSearch}>${loading ? 'Searching…' : `Search online database for “${q.trim()}”`}</button>`}
    ${online && html`<div class="h2"><span>Online results</span></div>${online.length ? html`<div class="list">${online.map(row)}</div>` : html`<div class="card empty">Nothing found online. Try a different name, scan the barcode, or create the food.</div>`}`}

    ${scan && html`<${Sheet} title="Scan barcode" onClose=${() => setScan(false)}><${BarcodeScanner} onCode=${onCode} /><//>`}
    ${quick && html`<${QuickAdd} date=${date} meal=${meal} onClose=${ok => { setQuick(false); if (ok) onClose(); }} />`}
    ${form && html`<${FoodForm} key=${form.k || 0} initial=${form.food} note=${form.note} onClose=${() => setForm(null)} onSave=${f => {
      mut(s => { s.myFoods.unshift(f); }); setForm(null); setDetail(f);
    }} />`}
    ${form && html`<button class="btn" style="position:absolute;z-index:50;right:16px;bottom:calc(var(--sb) + 16px);box-shadow:0 4px 16px #000" onClick=${() => fileRef.current.click()}>${icon('camera', 20)} Scan label</button>`}
    ${detail && html`<${FoodDetail} food=${detail} date=${date} meal=${meal} onClose=${() => setDetail(null)} onDone=${() => { setDetail(null); onClose(); }} />`}
    ${busy && html`<div class="busy"><div class="spin"></div>${busy}</div>`}
  <//>`;
}

/* ---------- diary ---------- */
export function FoodTab() {
  const [date, setDate] = useState(() => { const d = UI.foodDate || today(); UI.foodDate = null; return d; }), [add, setAdd] = useState(null), [edit, setEdit] = useState(null), [menu, setMenu] = useState(null);
  const t = targets(), day = S.entries.filter(e => e.date === date), tot = sumEntries(day), left = t.calories - tot.kcal;
  const saveMeal = mi => {
    const items = day.filter(e => e.meal === mi);
    const name = prompt('Name this meal', MEALS[mi]);
    if (!name) return;
    mut(s => { s.meals.push({ id: uid(), name: name.trim(), items: items.map(e => ({ food: { ...e.food }, qty: e.qty })) }); });
    toast('Meal saved');
  };
  const copyFrom = (mi, from) => {
    const src = S.entries.filter(e => e.date === from && e.meal === mi);
    if (!src.length) return toast('Nothing logged for that meal yesterday');
    mut(s => { src.forEach(e => s.entries.push({ ...e, id: uid(), date, food: { ...e.food } })); });
  };
  return html`<div class="screen">
    <div class="datebar">
      <button class="icon-btn" onClick=${() => setDate(addDays(date, -1))} aria-label="Previous day">${icon('left')}</button>
      <button class="d" onClick=${() => setDate(today())}>${niceDate(date)}</button>
      <button class="icon-btn" onClick=${() => setDate(addDays(date, 1))} aria-label="Next day">${icon('right')}</button>
    </div>
    <div class="card">
      <div class="eq">
        <div><div class="n">${num(t.calories)}</div><div class="l">Goal</div></div><div class="op">−</div>
        <div><div class="n">${num(tot.kcal)}</div><div class="l">Food</div></div><div class="op">=</div>
        <div><div class="n" style=${'color:' + (left < 0 ? 'var(--red)' : 'var(--green)')}>${num(Math.abs(left))}</div><div class="l">${left < 0 ? 'Over' : 'Remaining'}</div></div>
      </div>
      <div class="mt2">
        <${MacroBar} label="Protein" value=${tot.p} max=${t.protein} color=${COLORS.p} />
        <${MacroBar} label="Carbs" value=${tot.c} max=${t.carbs} color=${COLORS.c} />
        <${MacroBar} label="Fat" value=${tot.f} max=${t.fat} color=${COLORS.f} />
      </div>
    </div>
    ${MEALS.map((m, mi) => {
      const es = day.filter(e => e.meal === mi), mt = sumEntries(es);
      return html`<div class="list">
        <div class="meal-head"><div class="t">${m}</div>${es.length > 0 && html`<div class="k">${Math.round(mt.kcal)} cal · ${Math.round(mt.p)}g P</div>`}
          <button class="icon-btn" style="width:32px;height:28px" onClick=${() => setMenu(mi)} aria-label="Meal options">${icon('more', 20)}</button></div>
        ${es.map(e => html`<button class="item tap" onClick=${() => setEdit(e)}>
          <div class="grow"><div class="title ellip">${e.food.name}</div><div class="sub ellip">${e.food.quick ? 'Quick add' : `${e.food.brand ? e.food.brand + ' · ' : ''}${round(e.qty, 2)} × ${e.food.serving}`}</div></div>
          <div class="val">${Math.round(e.food.kcal * e.qty)}</div>
        </button>`)}
        <button class="addfood" onClick=${() => setAdd(mi)}>+ Add food</button>
      </div>`;
    })}
  </div>
    ${add != null && html`<${AddFood} date=${date} meal=${add} onClose=${() => setAdd(null)} />`}
    ${edit && html`<${FoodDetail} food=${edit.food} entry=${edit} date=${date} meal=${edit.meal} onClose=${() => setEdit(null)} onDone=${() => setEdit(null)} />`}
    ${menu != null && html`<${ActionSheet} title=${MEALS[menu]} onClose=${() => setMenu(null)} items=${[
      day.some(e => e.meal === menu) && { label: 'Save as meal', onClick: () => saveMeal(menu) },
      { label: 'Copy from yesterday', onClick: () => copyFrom(menu, addDays(date, -1)) },
      day.some(e => e.meal === menu) && { label: 'Clear this meal', danger: true, onClick: () => { if (confirm(`Remove everything from ${MEALS[menu]}?`)) mut(s => { s.entries = s.entries.filter(e => !(e.date === date && e.meal === menu)); }); } },
    ]} />`}`;
}
