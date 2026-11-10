// Shared building blocks: sheets, inputs, rings and charts.
import { html, render, useState, useEffect, useRef, useMemo } from '../vendor/preact.js';
export { html, render, useState, useEffect, useRef, useMemo };

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  food: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 2-3 5-3 8h3v10',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  barcode: 'M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  timer: 'M12 8v5l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 2h6',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 3 2 4 4 4M16 6h4c0 3-2 4-4 4M12 13v4M8 20h8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
};
export const icon = (name, size = 22) => html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${name === 'more' ? 3 : 2} stroke-linecap="round" stroke-linejoin="round"><path d=${ICONS[name]} /></svg>`;

export function Sheet({ title, onClose, children, full, action }) {
  return html`<div class="backdrop" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'sheet' + (full ? ' full' : '')}>
      <div class="sheet-head">
        <button class="icon-btn" aria-label="Close" onClick=${onClose}>${icon('x')}</button>
        <div class="sheet-title">${title}</div>
        <div class="sheet-action">${action}</div>
      </div>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`;
}

/** items: [{ label, danger, onClick }] */
export function ActionSheet({ title, items, onClose }) {
  return html`<div class="backdrop" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="sheet actions">
      ${title && html`<div class="actions-title">${title}</div>`}
      ${items.filter(Boolean).map(it => html`<button class=${'action' + (it.danger ? ' danger' : '') + (it.active ? ' active' : '')} onClick=${() => { onClose(); it.onClick(); }}>${it.label}</button>`)}
      <button class="action cancel" onClick=${onClose}>Cancel</button>
    </div>
  </div>`;
}

/** Number field that lets you type freely ("2." or empty) and reports a number or null. */
export function NumInput({ value, onInput, decimals = true, ...rest }) {
  const show = v => (v == null || Number.isNaN(v) ? '' : String(v));
  const [txt, setTxt] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(show(value)); }, [value]);
  return html`<input ...${rest} type="text" inputmode=${decimals ? 'decimal' : 'numeric'} value=${txt}
    onFocus=${e => { focused.current = true; const t = e.target; setTimeout(() => t.select && t.select(), 0); }}
    onBlur=${() => { focused.current = false; setTxt(show(value)); }}
    onInput=${e => {
      const s = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
      setTxt(s);
      const n = parseFloat(s);
      onInput(s === '' || Number.isNaN(n) ? null : n);
    }} />`;
}

export function Seg({ options, value, onChange }) {
  return html`<div class="seg">${options.map(o => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return html`<button class=${v === value ? 'on' : ''} onClick=${() => onChange(v)}>${label}</button>`;
  })}</div>`;
}

export function Ring({ value, max, size = 132, stroke = 12, color = 'var(--accent)', children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`}>
    <svg width=${size} height=${size}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--card2)" stroke-width=${stroke} />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${over ? 'var(--red)' : color} stroke-width=${stroke} stroke-linecap="round"
        stroke-dasharray=${c} stroke-dashoffset=${c * (1 - pct)} transform=${`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <div class="ring-in">${children}</div>
  </div>`;
}

export function MacroBar({ label, value, max, color, unit = 'g' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return html`<div class="macro">
    <div class="macro-top"><span>${label}</span><span class="muted"><b>${Math.round(value)}</b> / ${Math.round(max)}${unit}</span></div>
    <div class="bar"><div style=${`width:${pct}%;background:${value > max * 1.05 && label !== 'Protein' ? 'var(--red)' : color}`}></div></div>
  </div>`;
}

/** points: [{ label, y }]; optional second line `trend` with the same length. */
export function LineChart({ points, trend, color = 'var(--accent)', fmt = v => v, height = 150 }) {
  if (!points.length) return html`<div class="empty">No data yet</div>`;
  const W = 340, H = height, pl = 8, pr = 8, pt = 18, pb = 22;
  const ys = points.map(p => p.y).concat(trend || []);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mn === mx) { mn -= 1; mx += 1; }
  const pad = (mx - mn) * 0.12; const lo = mn - pad, hi = mx + pad;
  const n = points.length;
  const X = i => (n === 1 ? W / 2 : pl + (i * (W - pl - pr)) / (n - 1));
  const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const path = arr => arr.map((y, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
  const d = path(points.map(p => p.y));
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H}`}>
    <line x1=${pl} x2=${W - pr} y1=${Y(mx)} y2=${Y(mx)} class="grid" />
    <line x1=${pl} x2=${W - pr} y1=${Y(mn)} y2=${Y(mn)} class="grid" />
    <text x=${pl} y=${Y(mx) - 5} class="axis">${fmt(mx)}</text>
    <text x=${pl} y=${Y(mn) + 13} class="axis">${fmt(mn)}</text>
    ${n > 1 && html`<path d=${`${d} L${X(n - 1)} ${H - pb} L${X(0)} ${H - pb} Z`} fill=${color} opacity="0.12" />`}
    ${n > 1 && html`<path d=${d} fill="none" stroke=${color} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`}
    ${trend && n > 1 && html`<path d=${path(trend)} fill="none" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" />`}
    ${points.map((p, i) => (n <= 20 || i === n - 1) && html`<circle cx=${X(i)} cy=${Y(p.y)} r=${i === n - 1 ? 4.5 : 3} fill=${color} />`)}
    <text x=${pl} y=${H - 5} class="axis">${points[0].label}</text>
    ${n > 1 && html`<text x=${W - pr} y=${H - 5} class="axis" text-anchor="end">${points[n - 1].label}</text>`}
  </svg>`;
}

/** bars: [{ label, value, color? }] */
export function BarChart({ bars, goal, color = 'var(--accent)', fmt = v => Math.round(v), height = 150 }) {
  const W = 340, H = height, pt = 18, pb = 22, n = bars.length;
  const mx = Math.max(goal || 0, ...bars.map(b => b.value), 1) * 1.1;
  const bw = (W / n) * 0.6, step = W / n;
  const Y = v => pt + (1 - v / mx) * (H - pt - pb);
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H}`}>
    ${bars.map((b, i) => html`<g>
      <rect x=${i * step + (step - bw) / 2} y=${Y(b.value)} width=${bw} height=${Math.max(0, H - pb - Y(b.value))} rx="4" fill=${b.color || color} opacity=${b.value ? 1 : 0.2} />
      ${b.value > 0 && n <= 8 && html`<text x=${i * step + step / 2} y=${Y(b.value) - 4} class="axis" text-anchor="middle">${fmt(b.value)}</text>`}
      <text x=${i * step + step / 2} y=${H - 6} class="axis" text-anchor="middle">${b.label}</text>
    </g>`)}
    ${goal > 0 && html`<line x1="0" x2=${W} y1=${Y(goal)} y2=${Y(goal)} stroke="var(--text)" stroke-width="1" stroke-dasharray="4 4" opacity="0.6" />`}
  </svg>`;
}

export const Field = ({ label, children, hint }) => html`<label class="field"><span class="field-label">${label}</span>${children}${hint && html`<span class="hint">${hint}</span>`}</label>`;

/** Shrinks a photo so it is quick to read and small to store. Returns a canvas. */
export function loadImage(file, max = 1600) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not open that image')); };
    img.src = url;
  });
}
