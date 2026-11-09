/* Pluviômetro — chuva lançada por talhão. Os dados ficam no aparelho (localStorage). */
(() => {
'use strict';

const KEY = 'pluvio.v2';
// Pontos de coleta: os 20 talhões com contorno (KML) e os pontos da planilha que não têm contorno no mapa.
const EXTRA = [['armazem', 'Armazém'], ['retiro01', 'Retiro 01'], ['retiro02', 'Retiro 02'], ['retiro03', 'Retiro 03'], ['th08', 'TH 08'],
  ...[22, 23, 24, 25, 26, 27, 28, 29, 30].map(n => ['th' + n, 'TH ' + n])];
const groupOf = n => n.startsWith('Arm') ? 0 : n.startsWith('Cond') ? 1 : n.startsWith('Ret') ? 2 : 3;
const FIELDS = [...window.TALHOES.map(f => ({ ...f, name: f.name.replace('IT ', 'TH ') })), ...EXTRA.map(([id, name]) => ({ id, name, ha: null, rings: null }))]
  .sort((a, b) => groupOf(a.name) - groupOf(b.name) || a.name.localeCompare(b.name));
const FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]));
const MAPPED = FIELDS.filter(f => f.rings);
const AREA = MAPPED.reduce((a, f) => a + f.ha, 0);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  chev: '<svg class="chev" viewBox="0 0 7 12"><path d="m1 1 5 5-5 5"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7 6-7Zm3 4 5 6m0-6-5 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

/* ---------- datas e números ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const br = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const brShort = s => s.slice(8) + '/' + s.slice(5, 7);
const dayName = s => s === today() ? 'Hoje' : s === addDays(today(), -1) ? 'Ontem'
  : toDate(s).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const short = n => n.replace('Condomínio ', 'C').replace('Retiro ', 'R').replace('Armazém', 'Arm').replace('TH ', '');
const tileName = n => n.replace('Condomínio', 'Cond.');

/* ---------- estado ---------- */
const defaultSeason = () => { const d = new Date(); return `${d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1}-09-01`; };
function load() {
  const base = { settings: { farm: 'Fazenda Itaguaia', user: '', season: defaultSeason(), lastBackup: 0, seed: 0 }, readings: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}'), st = { ...base.settings, ...s.settings };
    if (st.farm === "Haras Olhos d'Água") st.farm = base.settings.farm; // nome provisório das primeiras versões
    return { settings: st, readings: s.readings || [] };
  } catch { return base; }
}
let db = load();
function importSeed() { // coletas da planilha, embutidas no app; entram uma vez por versão da planilha
  const C = window.COLETAS; if (!C || db.settings.seed >= C.version) return;
  const map = new Map(db.readings.map(r => [r.id, r])), now = Date.now();
  for (const [date, row] of Object.entries(C.days)) for (const [fieldId, mm] of Object.entries(row)) {
    const id = fieldId + '|' + date; map.set(id, { id, fieldId, date, mm, user: 'Planilha', updatedAt: now, deleted: false });
  }
  db.readings = [...map.values()]; db.settings.seed = C.version;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}
importSeed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('Sem espaço para salvar no aparelho'); } };
const ui = { tab: 'home', period: 'd7', allRank: false };
const readings = () => db.readings.filter(r => !r.deleted && FIELD[r.fieldId]);
const getReading = (fid, date) => db.readings.find(r => r.id === fid + '|' + date && !r.deleted);

const PERIODS = [['d1', 'Hoje'], ['d7', '7 dias'], ['d30', '30 dias'], ['safra', 'Safra']];
const periodLabel = p => PERIODS.find(x => x[0] === p)[1];
function range(p = ui.period) {
  const to = today();
  if (p === 'd1') return { from: to, to };
  if (p === 'd7') return { from: addDays(to, -6), to };
  if (p === 'd30') return { from: addDays(to, -29), to };
  return { from: db.settings.season > to ? to : db.settings.season, to };
}
const periodText = (p = ui.period) => { const { from, to } = range(p); return from === to ? br(to) : `${br(from)} a ${br(to)}`; };

/* ---------- cálculo ---------- */
function index() { // talhão -> { data: mm }
  const m = {};
  for (const r of readings()) (m[r.fieldId] ??= {})[r.date] = r.mm;
  return m;
}
function farmDays(idx) { // média simples dos pontos lidos em cada dia (nem todos têm área conhecida)
  const acc = {};
  for (const f of FIELDS) for (const [d, mm] of Object.entries(idx[f.id] || {})) { const a = acc[d] ??= [0, 0]; a[0] += mm; a[1] += 1; }
  return Object.fromEntries(Object.entries(acc).map(([d, a]) => [d, a[0] / a[1]]));
}
const sumRange = (days, from, to) => { let s = 0; for (const d in days) if (d >= from && d <= to) s += days[d]; return s; };
function stats(p = ui.period) {
  const { from, to } = range(p), idx = index(), farm = farmDays(idx);
  const rows = FIELDS.map(f => {
    const days = idx[f.id] || {}, n = Object.keys(days).filter(d => d >= from && d <= to).length;
    return { f, n, mm: sumRange(days, from, to) };
  });
  const ranked = [...rows].sort((a, b) => b.mm - a.mm || a.f.name.localeCompare(b.f.name));
  const withData = rows.filter(r => r.n);
  return { from, to, idx, farm, rows, ranked, mean: sumRange(farm, from, to), max: ranked[0].mm,
    rained: rows.filter(r => r.mm > 0).length, read: withData.length,
    low: withData.length ? withData.reduce((m, r) => r.mm < m.mm ? r : m) : null,
    rainDays: Object.keys(farm).filter(d => d >= from && d <= to && farm[d] > 0).length };
}
const delta = (mm, mean) => { if (!(mean > 0)) return ''; const p = Math.round((mm / mean - 1) * 100); return `<span class="${p >= 0 ? 'up' : 'dn'}">${p > 0 ? '+' : ''}${p}% da média</span>`; };

/* ---------- base de interface ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
const buzz = () => navigator.vibrate?.(8);
const chips = (cur, act = 'period') => `<div class="chips">${PERIODS.map(([id, l]) => `<button data-act="${act}" data-id="${id}" class="${id === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const head = (title, right = '') => `<div class="head"><div><div class="cap">${esc(db.settings.farm)}</div><h1>${title}</h1></div>${right}</div>`;
const shareBtn = `<button class="ibtn" data-act="share" aria-label="Enviar relatório">${I.share}</button>`;

const sheets = [];
function openSheet(html, { full = false, init } = {}) {
  const w = document.createElement('div');
  w.className = 'wrap' + (full ? ' full' : '');
  w.innerHTML = `<div class="back" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  $('#sheets').append(w); sheets.push(w);
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
  init?.(w);
  return w;
}
function closeSheet() {
  const w = sheets.pop(); if (!w) return;
  w.classList.remove('in'); setTimeout(() => w.remove(), 300);
  if (w.onclose) w.onclose();
}
const nav = (title, sub = '', left = '') => `<div class="nav">${left || '<span></span>'}<b>${title}${sub ? `<small>${sub}</small>` : ''}</b><button class="ibtn" data-act="close" aria-label="Fechar">${I.close}</button></div>`;

function render() {
  $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('#view').innerHTML = ({ home: viewHome, map: viewMap, history: viewHistory, more: viewMore })[ui.tab]();
  if (ui.tab === 'map') initMap();
}

/* ---------- gráfico de barras ---------- */
function barChart(items) { // [{label, v, tick}]
  const W = 320, H = 120, n = items.length, bw = W / n, max = Math.max(...items.map(i => i.v), 1), top = 16, base = H - 20;
  const bars = items.map((it, i) => {
    const h = it.v / max * (base - top), w = Math.min(bw * 0.62, 22), x = i * bw + (bw - w) / 2;
    return (it.v > 0 ? `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1.500).toFixed(1)}" rx="${Math.min(w / 2, 3)}"><title>${it.label}: ${fmt(it.v)} mm</title></rect>`
      : `<rect class="z" x="${(x + w / 2 - 1).toFixed(1)}" y="${base - 2}" width="2" height="2" rx="1"/>`)
      + (it.tick ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${it.tick}</text>` : '')
      + (n <= 12 && it.v > 0 ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${(base - h - 4).toFixed(1)}" text-anchor="middle">${fmt(it.v)}</text>` : '');
  }).join('');
  return `<div class="panel chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chuva por dia"><line x1="0" x2="${W}" y1="${base + .500}" y2="${base + .500}"/>${bars}</svg></div>`;
}
function seriesFor(days, p) {
  const { from, to } = p === 'd1' ? range('d7') : range(p), n = diffDays(from, to) + 1;
  if (n <= 31) return Array.from({ length: n }, (_, i) => { const d = addDays(from, i); return { label: brShort(d), v: days[d] || 0, tick: n <= 8 ? brShort(d) : (i % 7 === 0 || i === n - 1) && !(i % 7 && n - 1 - i < 5 && i !== n - 1) ? brShort(d) : (i === n - 1 ? brShort(d) : '') }; });
  const months = {};
  for (let d = from; d <= to; d = addDays(d, 1)) months[d.slice(0, 7)] = (months[d.slice(0, 7)] || 0) + (days[d] || 0);
  return Object.entries(months).map(([m, v]) => { const l = toDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); return { label: l, v, tick: l }; });
}

/* ---------- painel ---------- */
function viewHome() {
  const s = stats(), t = today();
  const doneToday = FIELDS.filter(f => getReading(f.id, t)).length;
  const cta = `<button class="pill" data-act="launch">${I.plus}Lançar chuva${doneToday ? ` <small>· hoje ${doneToday} de ${FIELDS.length}</small>` : ' de hoje'}</button>`;
  if (!readings().length) return head('Painel') + `<div class="empty"><h3>Nenhuma chuva lançada</h3><p>Toque no botão, escolha o talhão e digite quantos milímetros choveu.</p></div>${cta}`;
  const top = s.ranked[0], list = ui.allRank ? s.ranked : s.ranked.slice(0, 5);
  const rank = list.map((r, i) => `
    <button class="row" data-act="field" data-id="${r.f.id}">
      <span class="pos">${i + 1}</span>
      <div class="grow"><div class="t">${esc(r.f.name)}</div><div class="bar"><i style="width:${s.max ? r.mm / s.max * 100 : 0}%"></i></div></div>
      <div class="mm"><b>${r.n ? fmt(r.mm) : '–'}<small>mm</small></b>${r.n ? delta(r.mm, s.mean) : '<span>sem leitura</span>'}</div>
    </button>`).join('');
  return head('Painel', shareBtn) + chips(ui.period) + `
    <div class="hero"><div class="k">Chuva acumulada na fazenda</div>
      <div class="big">${fmt(s.mean)}<small>mm</small></div><div class="sub">${periodLabel(ui.period)} · ${periodText()} · média dos talhões</div></div>
    ${cta}
    <div class="kpis">
      <div class="kpi"><span>Talhões com chuva</span><b>${Math.round(s.rained / FIELDS.length * 100)}<small>%</small></b><em>${s.rained} de ${FIELDS.length} talhões</em></div>
      <div class="kpi"><span>Dias com chuva</span><b>${s.rainDays}<small>${s.rainDays === 1 ? 'dia' : 'dias'}</small></b><em>${periodLabel(ui.period)}</em></div>
      <div class="kpi"><span>Mais choveu</span><b>${top.mm > 0 ? fmt(top.mm) : '–'}<small>mm</small></b><em>${top.mm > 0 ? esc(top.f.name) : 'Sem chuva no período'}</em></div>
      <div class="kpi"><span>Menos choveu</span><b>${s.low ? fmt(s.low.mm) : '–'}<small>mm</small></b><em>${s.low ? esc(s.low.f.name) : 'Sem leituras'}</em></div>
    </div>
    <div class="sect"><h2>Chuva por dia</h2><span>${ui.period === 'd1' ? 'últimos 7 dias' : ui.period === 'safra' && diffDays(s.from, s.to) > 30 ? 'por mês' : 'mm'}</span></div>
    ${barChart(seriesFor(s.farm, ui.period))}
    <div class="sect"><h2>Onde mais choveu</h2><button data-act="allrank">${ui.allRank ? 'Mostrar menos' : `Ver os ${FIELDS.length}`}</button></div>
    <div class="panel">${rank}</div>`;
}

/* ---------- mapa ---------- */
const K = Math.cos(-14.92 * Math.PI / 180) * 111320, KY = 110540;
const proj = ([lon, lat]) => [(lon + 51.29) * K, -(lat + 14.92) * KY];
const GEO = MAPPED.map(f => {
  const rings = f.rings.map(r => r.map(proj)), r = rings[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const c = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += c; cx += (r[j][0] + r[i][0]) * c; cy += (r[j][1] + r[i][1]) * c; }
  return { id: f.id, d: rings.map(r => 'M' + r.map(p => p[0].toFixed(0) + ' ' + p[1].toFixed(0)).join('L') + 'Z').join(''), c: [cx / (3 * a), cy / (3 * a)], pts: rings.flat() };
});
function viewMap() {
  const s = stats(), max = Math.max(s.max, 1), by = Object.fromEntries(s.rows.map(r => [r.f.id, r]));
  const paths = GEO.map(g => { const r = by[g.id]; return r.n ? `<path class="f" data-id="${g.id}" d="${g.d}" fill="rgba(var(--rain-rgb),${(0.12 + 0.88 * r.mm / max).toFixed(2)})"/>` : `<path class="f none" data-id="${g.id}" d="${g.d}"/>`; }).join('');
  const labels = GEO.map(g => { const r = by[g.id], x = g.c[0].toFixed(0); return `<text x="${x}" y="${g.c[1].toFixed(0)}">${esc(short(r.f.name))}${r.n ? `<tspan class="m" x="${x}" dy="1.150em">${fmt(r.mm)}</tspan>` : ''}</text>`; }).join('');
  return head('Mapa', shareBtn) + chips(ui.period) + `
    <div class="mapcard">
      <svg class="map" role="img" aria-label="Mapa dos talhões">${paths}<g id="labels">${labels}</g></svg>
      <div class="legend">Chuva acumulada (mm)<i></i><div><span>0</span><span>${fmt(max)}</span></div></div>
      <button class="ibtn mapbtn" data-act="mapreset" aria-label="Centralizar mapa">${I.fit}</button>
    </div>
    <p class="note">Toque em um talhão para ver os detalhes. Use dois dedos para aproximar. ${FIELDS.length - MAPPED.length} pontos da planilha não têm contorno no mapa: ${FIELDS.filter(f => !f.rings).map(f => esc(short(f.name))).join(', ')}.</p>`;
}
let mapReset = () => {};
function initMap() {
  const svg = $('svg.map'); if (!svg) return;
  const box = svg.getBoundingClientRect(), all = GEO.flatMap(g => g.pts);
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  let w = (x1 - x0) * 1.12, h = (y1 - y0) * 1.12; const ar = box.width / box.height;
  if (w / h < ar) w = h * ar; else h = w / ar;
  const base = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
  let vb = { ...base };
  const apply = () => { svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); $('#labels', svg).setAttribute('font-size', (vb.w / box.width * 11).toFixed(1)); };
  mapReset = () => { vb = { ...base }; apply(); };
  apply();
  const zoom = (f, px, py) => {
    const nw = Math.min(base.w * 1.2, Math.max(base.w / 14, vb.w * f)), k = nw / vb.w;
    const sx = vb.x + px / box.width * vb.w, sy = vb.y + py / box.height * vb.h;
    vb = { x: sx - px / box.width * nw, y: sy - py / box.height * vb.h * k, w: nw, h: vb.h * k }; apply();
  };
  const P = new Map(); let moved = 0, lastDist = 0;
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); if (P.size === 1) moved = 0; lastDist = 0; });
  svg.addEventListener('pointermove', e => {
    const p = P.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1];
    P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 1) { moved += Math.abs(dx) + Math.abs(dy); const k = vb.w / box.width; vb.x -= dx * k; vb.y -= dy * k; apply(); }
    else if (P.size === 2) {
      const [a, b] = [...P.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastDist) zoom(lastDist / dist, (a[0] + b[0]) / 2 - box.left, (a[1] + b[1]) / 2 - box.top);
      lastDist = dist; moved = 99;
    }
  });
  const up = e => {
    if (P.size === 1 && moved < 8 && e.type === 'pointerup') {
      const id = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('path[data-id]')?.dataset.id;
      if (id) openField(id);
    }
    P.delete(e.pointerId); lastDist = 0;
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87, e.clientX - box.left, e.clientY - box.top); }, { passive: false });
}

/* ---------- detalhe do talhão ---------- */
function openField(id) {
  const f = FIELD[id], days = index()[id] || {}, t = today();
  buzz();
  const tot = PERIODS.map(([p, l]) => { const r = range(p); return `<div><b>${fmt(sumRange(days, r.from, r.to))}</b><span>${l}</span></div>`; }).join('');
  const rainDays = Object.keys(days).filter(d => days[d] > 0).sort(), last = rainDays.at(-1), sr = range('safra');
  const season = Object.entries(days).filter(([d]) => d >= sr.from && d <= sr.to);
  const best = season.reduce((m, e) => e[1] > m[1] ? e : m, ['', 0]);
  const s = stats('safra'), pos = s.ranked.findIndex(r => r.f.id === id) + 1;
  openSheet(nav(esc(f.name), f.ha ? `${fmt(f.ha)} ha` : 'Sem contorno no mapa') + `<div class="body">
    <div class="panel"><div class="grid4">${tot}</div></div>
    <div class="sect"><h2>Últimos 30 dias</h2><span>mm por dia</span></div>
    ${barChart(seriesFor(days, 'd30'))}
    <div class="sect"><h2>Na safra</h2><span>desde ${brShort(sr.from)}</span></div>
    <div class="panel">
      <div class="row"><div class="grow t">Posição entre os talhões</div><div class="v">${pos}º de ${FIELDS.length}</div></div>
      <div class="row"><div class="grow t">Dias com chuva</div><div class="v">${season.filter(e => e[1] > 0).length}</div></div>
      <div class="row"><div class="grow t">Maior chuva em um dia</div><div class="v">${best[1] ? `${fmt(best[1])} mm · ${brShort(best[0])}` : '–'}</div></div>
      <div class="row"><div class="grow t">Última chuva</div><div class="v">${last ? `${dayName(last)}${diffDays(last, t) > 1 ? ` · há ${diffDays(last, t)} dias` : ''}` : '–'}</div></div>
    </div>
    <div class="stack"><button class="pill orange" data-act="launch-field" data-id="${id}">${I.plus}Lançar chuva neste talhão</button></div>
  </div>`);
}

/* ---------- lançar chuva ---------- */
const L = { date: today(), sel: null, buf: '', fresh: true };
function openLaunch(date = today(), fid = null) {
  if (!db.settings.user) return askUser(() => openLaunch(date, fid));
  Object.assign(L, { date, sel: null });
  const w = openSheet('<div id="launch" style="display:contents"></div>', { full: true });
  w.onclose = render;
  fid ? pick(fid) : drawLaunch();
}
function drawLaunch() {
  const el = $('#launch'); if (!el) return;
  if (L.sel) return drawPad(el);
  const t = today(), y = addDays(t, -1), other = L.date !== t && L.date !== y;
  const done = FIELDS.filter(f => getReading(f.id, L.date)).length;
  el.innerHTML = nav('Lançar chuva', esc(db.settings.user)) + `<div class="body">
    <div class="chips" style="margin-bottom:18px">
      <button data-act="ldate" data-id="${t}" class="${L.date === t ? 'on' : ''}">Hoje</button>
      <button data-act="ldate" data-id="${y}" class="${L.date === y ? 'on' : ''}">Ontem</button>
      <label class="${other ? 'on' : ''}">${other ? br(L.date) : 'Outra data'}<input type="date" id="ldate" max="${t}" value="${L.date}" style="position:absolute;opacity:0;width:1px;height:1px" aria-label="Escolher outra data"></label>
    </div>
    <p class="hint">Toque no talhão e digite quantos milímetros choveu.</p>
    <div class="tiles">${FIELDS.map(f => { const r = getReading(f.id, L.date); return `<button class="tile ${r ? 'ok' : ''}" data-act="pick" data-id="${f.id}" aria-label="${esc(f.name)}${r ? `, ${fmt(r.mm)} milímetros` : ', sem leitura'}"><span>${esc(tileName(f.name))}</span><b>${r ? fmt(r.mm) : '–'}</b></button>`; }).join('')}</div>
    <div class="prog"><span>${done} de ${FIELDS.length} lançados</span><i><u style="width:${done / FIELDS.length * 100}%"></u></i></div>
    <div class="stack" style="margin-top:0">
      ${done < FIELDS.length ? `<button class="pill ghost" data-act="zero-rest">Marcar 0 mm nos ${FIELDS.length - done} restantes</button>` : ''}
      <button class="pill" data-act="close">Concluir</button>
    </div></div>`;
  $('#ldate', el).addEventListener('change', e => { if (e.target.value && e.target.value <= today()) { L.date = e.target.value; drawLaunch(); } });
  $('label', el).addEventListener('click', () => $('#ldate', el).showPicker?.());
}
function pick(fid) { const r = getReading(fid, L.date); Object.assign(L, { sel: fid, buf: r ? String(r.mm).replace('.', ',') : '', fresh: true }); drawLaunch(); }
function drawPad(el) {
  const f = FIELD[L.sel], r = getReading(f.id, L.date);
  el.innerHTML = `<div class="nav"><button class="ibtn" data-act="pad-back" aria-label="Voltar aos talhões">${I.back}</button>
      <b>${esc(f.name)}<small>${dayName(L.date)} · ${br(L.date)}</small></b>
      <button class="ibtn" data-act="pad-next" aria-label="Próximo talhão">${I.fwd}</button></div>
    <div class="pad">
      <div class="disp"><div class="was">${r ? `Lançado: ${fmt(r.mm)} mm · ${esc(r.user || '')}` : 'Sem leitura neste dia'}</div>
        <div class="n ${L.buf ? '' : 'dim'}" id="disp" aria-live="polite">${L.buf || '0'}<small>mm</small></div></div>
      <div class="keys">${['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0'].map(k => `<button data-act="key" data-id="${k}">${k}</button>`).join('')}
        <button class="l" data-act="key" data-id="del" aria-label="Apagar dígito">${I.del}</button></div>
      <button class="pill orange" data-act="pad-save">Salvar e ir ao próximo</button>
      ${r ? '<button class="skip" data-act="pad-clear">Apagar esta leitura</button>' : '<button class="skip" data-act="pad-next">Pular este talhão</button>'}
    </div>`;
}
function key(k) {
  if (k === 'del') { L.buf = L.fresh ? '' : L.buf.slice(0, -1); }
  else {
    if (L.fresh) L.buf = '';
    if (k === ',') { if (L.buf.includes(',')) return; L.buf = (L.buf || '0') + ','; }
    else {
      const [i, d] = L.buf.split(',');
      if (d !== undefined ? d.length >= 1 : i.length >= 3) return;
      L.buf = L.buf === '0' ? k : L.buf + k;
    }
  }
  L.fresh = false; buzz();
  const d = $('#disp'); d.firstChild.textContent = L.buf || '0'; d.classList.toggle('dim', !L.buf);
}
function putReading(fid, date, mm) {
  const id = fid + '|' + date, i = db.readings.findIndex(r => r.id === id);
  const r = { id, fieldId: fid, date, mm, user: db.settings.user, updatedAt: Date.now(), deleted: false };
  i >= 0 ? db.readings[i] = r : db.readings.push(r);
}
function nextField(onlyEmpty) {
  const i = FIELDS.findIndex(f => f.id === L.sel);
  for (let k = 1; k <= FIELDS.length; k++) {
    const f = FIELDS[(i + k) % FIELDS.length];
    if (!onlyEmpty) return f.id;
    if (!getReading(f.id, L.date)) return f.id;
  }
  return null;
}
function padSave() {
  if (!L.buf) return toast('Digite os milímetros ou toque em Pular');
  const mm = parseFloat(L.buf.replace(',', '.'));
  putReading(L.sel, L.date, mm); save(); buzz();
  const nx = nextField(true);
  if (nx) { toast(`${FIELD[L.sel].name}: ${fmt(mm)} mm`); pick(nx); }
  else { L.sel = null; drawLaunch(); toast('Todos os talhões lançados'); }
}

/* ---------- histórico ---------- */
function viewHistory() {
  const by = {};
  for (const r of readings()) (by[r.date] ??= []).push(r);
  const dates = Object.keys(by).sort().reverse();
  const h = head('Histórico', shareBtn);
  if (!dates.length) return h + `<div class="empty"><h3>Sem lançamentos</h3><p>Os dias lançados aparecem aqui. Toque em um dia para conferir ou corrigir.</p></div><button class="pill" data-act="launch">${I.plus}Lançar chuva</button>`;
  return h + `<div class="panel">${dates.slice(0, 400).map(d => {
    const rs = by[d], mean = rs.reduce((a, r) => a + r.mm, 0) / rs.length;
    const top = rs.reduce((m, r) => r.mm > m.mm ? r : m);
    return `<button class="row" data-act="day" data-id="${d}"><div class="grow"><div class="t">${dayName(d)} · ${brShort(d)}</div>
      <div class="s">${rs.length} talhões${top.mm > 0 ? ` · maior: ${esc(FIELD[top.fieldId].name)}, ${fmt(top.mm)} mm` : ' · sem chuva'}</div></div>
      <div class="mm"><b>${fmt(mean)}<small>mm</small></b></div>${I.chev}</button>`;
  }).join('')}</div><p class="note">Média da fazenda em cada dia. Toque em um dia para ver e corrigir os talhões.</p>`;
}

/* ---------- mais ---------- */
function viewMore() {
  const s = db.settings;
  return head('Mais') + `
    <div class="panel">
      <button class="row" data-act="share"><div class="grow"><div class="t">Enviar relatório</div><div class="s">WhatsApp, PDF ou planilha</div></div>${I.chev}</button>
      <button class="row" data-act="backup"><div class="grow"><div class="t">Fazer backup</div><div class="s">${s.lastBackup ? 'Último: ' + new Date(s.lastBackup).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Salva todas as leituras em um arquivo'}</div></div>${I.chev}</button>
      <button class="row" data-act="restore"><div class="grow"><div class="t">Importar backup</div><div class="s">Junta as leituras de outro celular, sem duplicar</div></div>${I.chev}</button>
    </div>
    <div class="sect"><h2>Fazenda</h2><span>${FIELDS.length} pontos de coleta</span></div>
    <div class="panel">
      <div class="row"><label class="t" for="sfarm">Nome</label><input id="sfarm" data-set="farm" value="${esc(s.farm)}" maxlength="40" placeholder="Nome da fazenda"></div>
      <div class="row"><label class="t" for="suser">Quem lança</label><input id="suser" data-set="user" value="${esc(s.user)}" maxlength="24" placeholder="Seu nome"></div>
      <div class="row"><label class="grow t" for="sseason">Início da safra</label><input type="date" id="sseason" data-set="season" value="${s.season}" max="${today()}"></div>
    </div>
    <p class="note">As coletas da planilha (safras 2024/25 e 2026/27, até ${window.COLETAS ? brShort(Object.keys(window.COLETAS.days).at(-1)) : ''}) já vêm no app. As novas leituras ficam neste celular. Para juntar com os outros, um faz o backup, envia o arquivo e o outro importa.</p>
    <div class="sect"></div>
    <div class="panel"><button class="row red" data-act="wipe"><div class="grow t">Apagar todas as leituras</div></button></div>
    <p class="note">Pluviômetro · versão 2.1</p>`;
}
function askUser(then) {
  openSheet(nav('Bem-vindo') + `<div class="body">
    <p class="hint">Como você se chama? Seu nome fica gravado nas leituras que você lançar.</p>
    <div class="panel"><div class="row"><input id="uname" style="text-align:left" placeholder="Seu nome" maxlength="24" autocomplete="given-name"></div></div>
    <div class="stack"><button class="pill" data-act="save-user">Continuar</button></div></div>`, { init: w => { w.then = then; setTimeout(() => $('#uname', w).focus(), 350); } });
}

/* ---------- relatórios ---------- */
function openShare() {
  let p = ui.period;
  const body = () => `${chips(p, 'share-period')}<p class="hint" style="margin-top:-8px">${periodText(p)}</p>
    <div class="stack" style="margin-top:0">
      <button class="pill wa" data-act="wa">Enviar no WhatsApp</button>
      <button class="pill" data-act="pdf">Salvar em PDF</button>
      <button class="pill ghost" data-act="csv">Exportar planilha (CSV)</button>
    </div>`;
  openSheet(nav('Relatório') + `<div class="body" id="sharebody">${body()}</div>`, { init: w => { w.period = () => p; w.setPeriod = v => { p = v; $('#sharebody', w).innerHTML = body(); }; } });
}
const sharePeriod = () => sheets.at(-1)?.period?.() || ui.period;
function waText(p) {
  const s = stats(p);
  const L = [`🌧️ *Chuva · ${db.settings.farm}*`, `${periodLabel(p)}: ${periodText(p)}`, '',
    `*Média da fazenda:* ${fmt(s.mean)} mm`, `*Talhões com chuva:* ${s.rained} de ${FIELDS.length} (${Math.round(s.rained / FIELDS.length * 100)}%)`, '', '*Chuva por talhão*'];
  s.ranked.filter(r => r.n).forEach((r, i) => L.push(`${i + 1}. ${r.f.name}: ${fmt(r.mm)} mm`));
  const none = s.rows.filter(r => !r.n);
  if (none.length) L.push('', `Sem leitura: ${none.map(r => r.f.name).join(', ')}`);
  if (db.settings.user) L.push('', `_Enviado por ${db.settings.user}_`);
  return L.join('\n');
}
async function deliver(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
async function makePdf(p) {
  if (!window.jspdf) { await loadScript('vendor/jspdf.umd.min.js'); await loadScript('vendor/jspdf.plugin.autotable.min.js'); }
  const s = stats(p), doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), gray = [110, 110, 110];
  doc.setFillColor(0).rect(0, 0, 210, 34, 'F');
  doc.setFont('helvetica', 'normal').setFontSize(22).setTextColor(255).text('Relatório de chuva', 14, 18);
  doc.setFontSize(10.500).setTextColor(190).text(`${db.settings.farm}  ·  ${periodLabel(p)}: ${periodText(p)}`, 14, 26);
  const box = (x, label, value) => { doc.setFontSize(9).setTextColor(...gray).text(label, x, 44); doc.setFontSize(17).setTextColor(0).text(value, x, 52); };
  box(14, 'Média da fazenda', `${fmt(s.mean)} mm`);
  box(64, 'Talhões com chuva', `${s.rained} de ${FIELDS.length}`);
  box(114, 'Dias com chuva', String(s.rainDays));
  box(152, 'Mais choveu', s.max > 0 ? `${short(s.ranked[0].f.name)} · ${fmt(s.max)} mm` : '-');
  const table = (startY, title, headRow, body, columnStyles) => {
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0).text(title, 14, startY);
    doc.autoTable({ startY: startY + 3, head: [headRow], body, theme: 'striped', margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 9.500, cellPadding: 2.200 }, headStyles: { fillColor: [0, 0, 0], textColor: 255 }, alternateRowStyles: { fillColor: [245, 245, 245] }, columnStyles });
    return doc.lastAutoTable.finalY;
  };
  const num = { halign: 'right' };
  let y = table(64, 'Chuva por talhão', ['#', 'Talhão', 'Área (ha)', 'Chuva (mm)', 'Comparado à média', 'Dias lidos'],
    s.ranked.map((r, i) => [i + 1, r.f.name, r.f.ha ? fmt(r.f.ha) : '-', r.n ? fmt(r.mm) : '-', r.n && s.mean > 0 ? `${r.mm >= s.mean ? '+' : ''}${Math.round((r.mm / s.mean - 1) * 100)}%` : '-', r.n]),
    { 0: { cellWidth: 10 }, 2: num, 3: { ...num, fontStyle: 'bold' }, 4: num, 5: num });
  const dates = [...new Set(readings().filter(r => r.date >= s.from && r.date <= s.to).map(r => r.date))].sort().reverse();
  if (dates.length && dates.length <= 40) {
    doc.addPage('a4', 'landscape');
    const cols = FIELDS.map(f => short(f.name));
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0).text('Leituras por dia (mm)', 10, 14);
    doc.autoTable({ startY: 17, head: [['Data', ...cols, 'Média']], body: dates.map(d => [brShort(d), ...FIELDS.map(f => { const v = s.idx[f.id]?.[d]; return v == null ? '' : fmt(v); }), fmt(s.farm[d])]),
      theme: 'grid', margin: { left: 10, right: 10 }, styles: { font: 'helvetica', fontSize: 6, cellPadding: .900, halign: 'right', lineColor: 225, lineWidth: .100, overflow: 'visible' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: 'right' }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, [cols.length + 1]: { fontStyle: 'bold' } } });
  }
  const n = doc.getNumberOfPages(), stamp = `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${db.settings.user ? ' por ' + db.settings.user : ''}`;
  for (let i = 1; i <= n; i++) { doc.setPage(i).setFont('helvetica', 'normal').setFontSize(8).setTextColor(...gray); const ph = doc.internal.pageSize.getHeight(), pw = doc.internal.pageSize.getWidth(); doc.text(stamp, 14, ph - 7); doc.text(`${i} / ${n}`, pw - 14, ph - 7, { align: 'right' }); }
  return doc.output('blob');
}
function makeCsv(p) {
  const { from, to } = range(p), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Data', 'Talhão', 'Área (ha)', 'Chuva (mm)', 'Quem lançou']];
  readings().filter(r => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date) || FIELDS.indexOf(FIELD[a.fieldId]) - FIELDS.indexOf(FIELD[b.fieldId]))
    .forEach(r => rows.push([br(r.date), FIELD[r.fieldId].name, String(FIELD[r.fieldId].ha ?? '').replace('.', ','), String(r.mm).replace('.', ','), r.user]));
  return new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
}
const fileStamp = p => { const r = range(p); return `${r.from}_a_${r.to}`; };

/* ---------- backup ---------- */
async function backup() {
  const blob = new Blob([JSON.stringify({ app: 'pluviometro', version: 2, exportedAt: new Date().toISOString(), by: db.settings.user, ...db })], { type: 'application/json' });
  if (await deliver(blob, `backup-chuva-${today()}.json`, 'Backup de chuva')) { db.settings.lastBackup = Date.now(); save(); render(); toast('Backup gerado'); }
}
function restore(text) {
  let d; try { d = JSON.parse(text); } catch { return toast('Arquivo inválido'); }
  if (d?.app !== 'pluviometro' || d.version !== 2 || !Array.isArray(d.readings)) return toast('Este arquivo não é um backup deste app');
  if (!d.readings.every(r => r.id && r.fieldId && /^\d{4}-\d\d-\d\d$/.test(r.date) && typeof r.mm === 'number')) return toast('Backup corrompido');
  let n = 0; const map = new Map(db.readings.map(r => [r.id, r]));
  for (const t of d.readings) { const m = map.get(t.id); if (!m || (t.updatedAt || 0) > (m.updatedAt || 0)) { map.set(t.id, t); if (!t.deleted) n++; } }
  db.readings = [...map.values()];
  save(); render(); toast(n ? `${n} ${n === 1 ? 'leitura importada' : 'leituras importadas'}` : 'Tudo já estava atualizado');
}

/* ---------- eventos ---------- */
const actions = {
  close: closeSheet,
  period: el => { ui.period = el.dataset.id; render(); },
  allrank: () => { ui.allRank = !ui.allRank; render(); },
  launch: () => openLaunch(),
  'launch-field': el => { closeSheet(); openLaunch(today(), el.dataset.id); },
  day: el => openLaunch(el.dataset.id),
  field: el => openField(el.dataset.id),
  share: openShare,
  mapreset: () => mapReset(),
  'share-period': el => sheets.at(-1).setPeriod(el.dataset.id),
  ldate: el => { L.date = el.dataset.id; drawLaunch(); },
  pick: el => pick(el.dataset.id),
  key: el => key(el.dataset.id),
  'pad-back': () => { L.sel = null; drawLaunch(); },
  'pad-next': () => pick(nextField(false)),
  'pad-save': padSave,
  'pad-clear': () => {
    const r = getReading(L.sel, L.date); if (!r || !confirm(`Apagar a leitura de ${FIELD[L.sel].name} em ${br(L.date)}?`)) return;
    r.deleted = true; r.updatedAt = Date.now(); save(); L.sel = null; drawLaunch(); toast('Leitura apagada');
  },
  'zero-rest': () => {
    const rest = FIELDS.filter(f => !getReading(f.id, L.date));
    if (!confirm(`Registrar 0 mm (sem chuva) em ${rest.length} ${rest.length === 1 ? 'talhão' : 'talhões'} em ${br(L.date)}?`)) return;
    rest.forEach(f => putReading(f.id, L.date, 0)); save(); drawLaunch(); toast('Restantes marcados com 0 mm');
  },
  'save-user': (el, w) => {
    const n = $('#uname', w).value.trim(); if (!n) return toast('Informe seu nome');
    db.settings.user = n; save(); const then = w.then; closeSheet(); render(); then?.();
  },
  wa: () => { window.open('https://wa.me/?text=' + encodeURIComponent(waText(sharePeriod())), '_blank', 'noopener'); },
  pdf: async el => {
    const p = sharePeriod(); el.disabled = true; el.textContent = 'Gerando PDF…';
    try { await deliver(await makePdf(p), `chuva-${fileStamp(p)}.pdf`, 'Relatório de chuva'); }
    catch (e) { console.error(e); toast('Não foi possível gerar o PDF'); }
    el.disabled = false; el.textContent = 'Salvar em PDF';
  },
  csv: () => { const p = sharePeriod(); deliver(makeCsv(p), `chuva-${fileStamp(p)}.csv`, 'Leituras de chuva'); },
  backup,
  restore: () => $('#file').click(),
  wipe: () => {
    const n = readings().length; if (!n) return toast('Não há leituras');
    if (!confirm(`Apagar as ${n} leituras deste celular? Faça um backup antes. Não dá para desfazer.`)) return;
    db.readings = []; save(); render(); toast('Leituras apagadas');
  },
};
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { ui.tab = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  actions[el.dataset.act]?.(el, el.closest('.wrap'));
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set; if (!k) return;
  const v = e.target.value.trim();
  if (k === 'season' && !v) return;
  db.settings[k] = v; save();
});
document.addEventListener('keydown', e => {
  if (L.sel && $('#disp')) {
    if (/^[0-9]$/.test(e.key)) return key(e.key);
    if (e.key === ',' || e.key === '.') return key(',');
    if (e.key === 'Backspace') return key('del');
    if (e.key === 'Enter') return padSave();
  }
  if (e.key === 'Enter' && e.target.id === 'uname') return actions['save-user'](null, e.target.closest('.wrap'));
  if (e.key === 'Escape') closeSheet();
});
$('#file').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(await f.text()); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => ui.tab === 'map' && !sheets.length && render(), 200); });

render();
if (!db.settings.user) askUser();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.();
})();
