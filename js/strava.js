// Strava link: sign in with your own Strava API application, then pull activities in as workouts.
// The connection details live in their own storage slot on this phone and are never part of a backup file.
import { html, useState, Sheet, Field, icon } from './ui.js';
import { S, mut, ui, uid, toast, kvGet, kvSet, kvDel } from './store.js';
import { isImp, fmtDur, fmtDate, num, round } from './calc.js';

const API = 'https://www.strava.com/api/v3';
const LOOKBACK_DAYS = 30, MAX_NEW_PER_SYNC = 40;
export let ST = null; // { clientId, clientSecret, state, pending, access, refresh, expires, athlete, lastSync, error }
let syncing = false;
export const isSyncing = () => syncing;
const redirectUri = () => location.origin + location.pathname;
async function save() { if (ST) await kvSet('strava', ST); else await kvDel('strava'); ui(() => {}); }

/* ---------- formatting ---------- */
export const sportName = w => (w.sport || 'Activity').replace(/([a-z])([A-Z])/g, '$1 $2');
const FOOT = /Run|Walk|Hike/;
export function stravaStats(w) {
  const out = [];
  const dist = w.distance ? (isImp() ? w.distance / 1609.344 : w.distance / 1000) : 0, du = isImp() ? 'mi' : 'km';
  if (dist >= 0.05) out.push(['Distance', `${round(dist, 2)} ${du}`]);
  out.push(['Time', fmtDur((w.moving || 0) * 1000)]);
  if (dist >= 0.05 && w.moving) {
    if (FOOT.test(w.sport || '')) { const p = w.moving / dist; out.push(['Pace', `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')} /${du}`]); } else out.push(['Speed', `${round(dist / (w.moving / 3600), 1)} ${isImp() ? 'mph' : 'km/h'}`]);
  }
  if (w.calories) out.push(['Calories', num(w.calories)]);
  if (w.elev >= 1) out.push(['Elevation', isImp() ? `${num(w.elev * 3.28084)} ft` : `${num(w.elev)} m`]);
  if (w.hr) out.push(['Avg heart rate', `${Math.round(w.hr)} bpm`]);
  return out;
}
export const stravaLine = w => [sportName(w)].concat(stravaStats(w).slice(0, 2).map(x => x[1]), w.calories ? [`${num(w.calories)} cal`] : []).join(' · ');

/* ---------- Strava requests ---------- */
async function tokenReq(params) {
  let r;
  try { r = await fetch(API + '/oauth/token', { method: 'POST', body: new URLSearchParams({ client_id: ST.clientId, client_secret: ST.clientSecret, ...params }) }); } catch (e) { throw new Error('Could not reach Strava. Check your connection.'); }
  if (!r.ok) throw new Error(r.status === 400 || r.status === 401 ? 'Strava did not accept the Client ID / Client Secret, or the sign-in expired. Check them and connect again.' : 'Strava is not responding. Try again later.');
  return r.json();
}
function storeTokens(j) { ST.access = j.access_token; ST.refresh = j.refresh_token; ST.expires = j.expires_at; }
async function token() {
  if (ST.expires - 120 > Date.now() / 1000) return ST.access;
  storeTokens(await tokenReq({ grant_type: 'refresh_token', refresh_token: ST.refresh }));
  await kvSet('strava', ST);
  return ST.access;
}
async function api(path) {
  const t = await token();
  let r;
  try { r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + t } }); } catch (e) { throw new Error('Could not reach Strava. Check your connection.'); }
  if (r.status === 429) throw new Error('Strava is limiting requests right now. Try again in 15 minutes.');
  if (r.status === 401) throw new Error('Strava access was removed. Disconnect and connect again.');
  if (!r.ok) throw new Error('Strava error ' + r.status);
  return r.json();
}

/* ---------- connect / disconnect ---------- */
export async function connect(clientId, clientSecret) {
  ST = { clientId: clientId.trim(), clientSecret: clientSecret.trim(), state: uid(), pending: true };
  await kvSet('strava', ST);
  location.href = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(ST.clientId)}&redirect_uri=${encodeURIComponent(redirectUri())}&response_type=code&approval_prompt=auto&scope=${encodeURIComponent('read,activity:read_all')}&state=${ST.state}`;
}
export async function disconnect() {
  if (ST && ST.access) { try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', body: new URLSearchParams({ access_token: await token() }) }); } catch (e) { /* still forget it locally */ } }
  ST = null; await save();
}
/** Called on launch: finishes the sign-in when Strava sends the browser back here. */
export async function handleRedirect(search = location.search) {
  const q = new URLSearchParams(search);
  if (!q.has('state') || !(q.has('code') || q.has('error'))) return false;
  history.replaceState(null, '', redirectUri());
  if (!ST || !ST.pending || q.get('state') !== ST.state) { toast('Strava sign-in did not start from this app. Try Connect again.'); return true; }
  ST.pending = false;
  if (q.has('error')) { ST.error = 'Strava access was not approved.'; await save(); toast(ST.error); return true; }
  if (!(q.get('scope') || '').includes('activity:read')) { ST.error = 'Leave "View data about your activities" ticked when you approve, then connect again.'; await save(); toast('Activity access was not granted'); return true; }
  try {
    const j = await tokenReq({ code: q.get('code'), grant_type: 'authorization_code' });
    storeTokens(j);
    ST.athlete = j.athlete ? [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ') : '';
    ST.error = null;
    await save();
    ui(u => { u.tab = 'profile'; });
    toast('Strava connected');
    sync(true);
  } catch (e) { ST.error = e.message; await save(); toast('Strava connection failed'); }
  return true;
}

/* ---------- sync ---------- */
const toWorkout = (a, calories) => {
  const start = Date.parse(a.start_date);
  return {
    id: 'strava-' + a.id, stravaId: a.id, source: 'strava', name: a.name || 'Strava activity', sport: a.sport_type || a.type || 'Workout',
    start, end: start + (a.elapsed_time || a.moving_time || 0) * 1000, moving: a.moving_time || a.elapsed_time || 0,
    distance: a.distance || 0, elev: a.total_elevation_gain || 0, hr: a.average_heartrate || null,
    calories: calories || (a.kilojoules ? Math.round(a.kilojoules) : null), exercises: [],
  };
};
export async function sync(manual) {
  if (!ST || !ST.access || syncing) return;
  syncing = true; ui(() => {});
  try {
    const after = Math.floor(Date.now() / 1000 - LOOKBACK_DAYS * 86400);
    let all = [];
    for (let page = 1; page <= 3; page++) {
      const a = await api(`/athlete/activities?after=${after}&per_page=100&page=${page}`);
      all = all.concat(a);
      if (a.length < 100) break;
    }
    const have = new Set(S.workouts.filter(w => w.stravaId).map(w => w.stravaId)), skip = new Set(S.stravaSkip || []);
    const fresh = all.filter(a => !have.has(a.id) && !skip.has(a.id)).slice(0, MAX_NEW_PER_SYNC);
    const items = [];
    for (const a of fresh) {
      let cal = null;
      try { cal = (await api('/activities/' + a.id)).calories || null; } catch (e) { /* summary data is enough */ }
      items.push(toWorkout(a, cal));
    }
    if (items.length) mut(s => { s.workouts = s.workouts.concat(items).sort((x, y) => x.start - y.start); });
    ST.lastSync = Date.now(); ST.error = null;
    if (manual || items.length) toast(items.length ? `${items.length} Strava activit${items.length > 1 ? 'ies' : 'y'} added` : 'Strava is up to date');
  } catch (e) {
    ST.error = e.message;
    if (manual) toast(e.message);
  }
  syncing = false;
  await save();
}
export async function initStrava() {
  try { ST = (await kvGet('strava')) || null; } catch (e) { ST = null; }
  const redirected = await handleRedirect();
  if (!redirected) sync(false);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ST && ST.access && Date.now() - (ST.lastSync || 0) > 5 * 60000) sync(false); });
}

/* ---------- screens ---------- */
export function StravaDetail({ w, onClose }) {
  const del = () => {
    if (!confirm('Remove this activity from GetFit? It stays on Strava and will not be imported again.')) return;
    mut(s => { s.workouts = s.workouts.filter(x => x.id !== w.id); s.stravaSkip = (s.stravaSkip || []).concat(w.stravaId).slice(-500); });
    onClose();
  };
  return html`<${Sheet} title=${w.name} onClose=${onClose}>
    <div class="center"><span class="tag strava">STRAVA</span> <span class="muted small">${sportName(w)} · ${fmtDate(w.start, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
    <div class="card grid2 mt" style="row-gap:16px">${stravaStats(w).map(([l, v]) => html`<div class="stat"><div class="n">${v}</div><div class="l">${l}</div></div>`)}</div>
    <a class="btn block" href=${'https://www.strava.com/activities/' + w.stravaId} target="_blank" rel="noopener">View on Strava</a>
    <button class="btn block danger mt" onClick=${del}>Remove from GetFit</button>
  <//>`;
}

export function StravaCard() {
  const [form, setForm] = useState(null), [help, setHelp] = useState(false);
  const connected = ST && ST.access;
  const go = () => {
    if (!/^\d+$/.test(form.id.trim())) return toast('The Client ID is a number');
    if (form.secret.trim().length < 20) return toast('Paste the full Client Secret');
    connect(form.id, form.secret);
  };
  return html`<div class="card">
    ${connected ? html`
      <div class="row between"><div><div class="card-title">Connected${ST.athlete ? ' as ' + ST.athlete : ''}</div>
        <div class="muted small">${syncing ? 'Syncing…' : ST.lastSync ? 'Last synced ' + new Date(ST.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'} · ${S.workouts.filter(w => w.stravaId).length} activities imported</div></div></div>
      ${ST.error && html`<div class="note mt">${ST.error}</div>`}
      <div class="muted small mt">New Strava activities are added automatically each time you open GetFit.</div>
      <div class="grid2 mt"><button class="btn" disabled=${syncing} onClick=${() => sync(true)}>Sync now</button><button class="btn danger" onClick=${() => { if (confirm('Disconnect Strava? Activities already imported stay in GetFit.')) disconnect(); }}>Disconnect</button></div>` : html`
      <div class="muted small" style="margin-bottom:12px">Link Strava to add your runs, rides and other activities to your workout history automatically.</div>
      ${ST && ST.error && html`<div class="note">${ST.error}</div>`}
      <button class="btn primary block" onClick=${() => setForm({ id: (ST && ST.clientId) || '', secret: '' })}>Connect Strava</button>`}
    ${form && html`<${Sheet} title="Connect Strava" onClose=${() => setForm(null)}>
      <div class="muted small" style="margin-bottom:12px">Strava needs you to register GetFit as your own personal app once. It is free and takes a couple of minutes.</div>
      <button class="btn block" style="margin-bottom:14px" onClick=${() => setHelp(!help)}>${help ? 'Hide steps' : 'Show me the steps'}</button>
      ${help && html`<div class="card small">
        <div>1. On strava.com open <b>Settings → My API Application</b> (strava.com/settings/api).</div>
        <div class="mt">2. Create an application. Name: <b>GetFit</b>. Website: <b>${redirectUri()}</b></div>
        <div class="mt">3. Authorization Callback Domain: <b>${location.hostname}</b></div>
        <div class="mt">4. Upload any picture as the icon when asked.</div>
        <div class="mt">5. Copy the <b>Client ID</b> and <b>Client Secret</b> into the boxes below.</div>
      </div>`}
      <${Field} label="Client ID"><input inputmode="numeric" value=${form.id} onInput=${e => setForm({ ...form, id: e.target.value })} placeholder="e.g. 123456" /><//>
      <${Field} label="Client Secret" hint="Stored only on this phone. It is not included in backups."><input type="password" autocomplete="off" autocapitalize="off" autocorrect="off" value=${form.secret} onInput=${e => setForm({ ...form, secret: e.target.value })} /><//>
      <button class="btn primary block" onClick=${go}>Continue to Strava</button>
      <div class="muted small center mt">You will approve access on Strava, then come straight back here.</div>
    <//>`}
  </div>`;
}
