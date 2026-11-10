// Barcode scanning, the online food database, and reading nutrition labels from a photo.
import { html, useState, useEffect, useRef, loadImage } from './ui.js';
import { S, uid } from './store.js';
import { round } from './calc.js';

const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';
const OFF_FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments';

/* ---------- Open Food Facts (free, community food database) ---------- */
function fromOFF(p) {
  const n = p.nutriments || {};
  const g = parseFloat(p.serving_quantity) || 0;
  const per = k => {
    if (g && n[k + '_serving'] != null) return +n[k + '_serving'];
    const v = n[k + '_100g'];
    return v == null ? 0 : +v * (g ? g / 100 : 1);
  };
  let kcal = per('energy-kcal');
  if (!kcal && n['energy_100g']) kcal = (n['energy_100g'] / 4.184) * (g ? g / 100 : 1);
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || '').split(',')[0];
  return {
    id: uid(), name: (p.product_name || '').trim() || 'Unnamed product', brand: (brand || '').trim(),
    serving: g ? p.serving_size || g + ' g' : '100 g', grams: g || 100,
    kcal: Math.round(kcal), p: round(per('proteins'), 1), c: round(per('carbohydrates'), 1), f: round(per('fat'), 1),
    fiber: round(per('fiber'), 1), sugar: round(per('sugars'), 1), sodium: Math.round(per('sodium') * 1000),
    barcode: p.code || '',
  };
}
export async function lookupBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('The food database is not responding. Try again in a moment.');
  const j = await r.json();
  return j.status === 1 && j.product ? fromOFF({ ...j.product, code }) : null;
}
/* USDA FoodData Central: second source for search. Works without a key at a low hourly limit. */
function fromUSDA(f) {
  const nv = id => { const n = (f.foodNutrients || []).find(x => x.nutrientId === id); return n ? +n.value : 0; };
  const unit = (f.servingSizeUnit || '').toLowerCase(), hasServing = f.servingSize > 0 && /^(g|grm|ml|mlt)$/.test(unit);
  const g = hasServing ? f.servingSize : 100, k = g / 100;
  const nice = t => (t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (m, a, c) => a + c.toUpperCase()) : t || '');
  return {
    id: uid(), name: nice(f.description) || 'Unnamed food', brand: nice(f.brandName || f.brandOwner || ''),
    serving: hasServing ? (f.householdServingFullText ? `${f.householdServingFullText.toLowerCase()} (${round(g, 0)} g)` : `${round(g, 0)} g`) : '100 g', grams: g,
    kcal: Math.round((nv(1008) || nv(2047)) * k), p: round(nv(1003) * k, 1), c: round(nv(1005) * k, 1), f: round(nv(1004) * k, 1),
    fiber: round(nv(1079) * k, 1), sugar: round(nv(2000) * k, 1), sodium: Math.round(nv(1093) * k), barcode: f.gtinUpc || '',
  };
}
async function searchOFF(q) {
  const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`);
  if (!r.ok) throw new Error('unavailable');
  const j = await r.json();
  return (j.products || []).filter(p => p.product_name && p.nutriments && (p.nutriments['energy-kcal_100g'] != null || p.nutriments['energy_100g'] != null)).map(fromOFF);
}
async function searchUSDA(q) {
  const key = (S.settings.usdaKey || '').trim() || 'DEMO_KEY';
  const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&dataType=${encodeURIComponent('Branded,Foundation,SR Legacy')}&api_key=${encodeURIComponent(key)}`);
  if (r.status === 429) throw new Error('limit');
  if (!r.ok) throw new Error('unavailable');
  const j = await r.json();
  return (j.foods || []).map(fromUSDA).filter(f => f.kcal > 0 || f.p > 0);
}
export async function searchFoods(q) {
  const order = S.settings.usdaKey ? [searchUSDA, searchOFF] : [searchOFF, searchUSDA];
  let limited = false;
  for (const fn of order) {
    try { const res = await fn(q); if (res.length) return res; } catch (e) { if (e.message === 'limit') limited = true; else if (!navigator.onLine) break; }
  }
  if (!navigator.onLine) throw new Error('You are offline. Online search needs a connection.');
  if (limited) throw new Error('Search limit reached for this hour. Add a free USDA key in Profile to remove it.');
  return [];
}

/* ---------- live barcode scanner ---------- */
export function BarcodeScanner({ onCode }) {
  const vid = useRef(null);
  const [err, setErr] = useState(''), [manual, setManual] = useState('');
  useEffect(() => {
    let stop = null, dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
        const Z = await import(ZXING);
        const reader = new Z.BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, vid.current, (res, e, c) => {
          if (res && !dead) { dead = true; c.stop(); onCode(res.getText()); }
        });
        stop = () => controls.stop();
        if (dead) stop();
      } catch (e) {
        setErr(e && e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this app in Settings, or type the barcode below.' : 'Camera is not available here. Type the barcode number below instead.');
      }
    })();
    return () => { dead = true; if (stop) stop(); };
  }, []);
  return html`<div>
    ${err ? html`<div class="note">${err}</div>` : html`<div class="scanner"><video ref=${vid} playsinline muted autoplay></video><div class="frame"></div></div>
      <div class="muted small center" style="margin-bottom:14px">Hold the barcode inside the frame</div>`}
    <div class="row"><input class="input grow" inputmode="numeric" placeholder="Or type the barcode number" value=${manual} onInput=${e => setManual(e.target.value.replace(/\D/g, ''))} />
      <button class="btn primary" disabled=${manual.length < 6} onClick=${() => onCode(manual)}>Look up</button></div>
  </div>`;
}

/* ---------- nutrition label reading (runs on the phone, no account needed) ---------- */
export function parseLabel(text) {
  const t = text.replace(/\r/g, '').replace(/[|]/g, ' ');
  const N = '([\\dOo]{1,4}(?:[.,]\\d+)?)\\s*(mg|g)?';
  const grab = (pat, gap = 8) => {
    const m = t.match(new RegExp(pat + `[^\\dOo\\n]{0,${gap}}` + N, 'i'));
    if (!m) return null;
    let s = m[1].replace(/[oO]/g, '0').replace(',', '.');
    // "8g" is often misread as "89": drop a trailing 9 when no unit was seen
    if (!m[2] && /^\d+9$/.test(s) && s.length >= 2) s = s.slice(0, -1);
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  };
  const cal = t.match(/calories(?!\s*from)[^\d\n]{0,14}(\d{1,4})/i) || t.match(/energy[^\d\n]{0,14}(\d{1,4})\s*k?cal/i);
  const serving = t.match(/serving size[:\s]*([^\n]{2,40})/i);
  const grams = serving && serving[1].match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return {
    name: '', brand: '',
    serving: serving ? serving[1].trim().replace(/\s+/g, ' ') : '1 serving',
    grams: grams ? parseFloat(grams[1]) : null,
    kcal: cal ? +cal[1] : null,
    f: grab('total\\s*fat'), c: grab('total\\s*carb[a-z.]*'), p: grab('protein'),
    fiber: grab('fib(?:er|re)'), sugar: grab('(?:total\\s*)?sugars?'), sodium: grab('sodium'),
  };
}

export async function readLabel(file, onProgress) {
  const src = await loadImage(file, 1800);
  // grayscale + contrast stretch helps the text recogniser
  const ctx = src.getContext('2d'), img = ctx.getImageData(0, 0, src.width, src.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    v = Math.max(0, Math.min(255, (v - 128) * 1.4 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const T = await import(TESSERACT);
  const createWorker = T.createWorker || (T.default && T.default.createWorker);
  const worker = await createWorker('eng', 1, { logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); } });
  try {
    const { data } = await worker.recognize(src);
    return { text: data.text, ...parseLabel(data.text) };
  } finally { await worker.terminate(); }
}
