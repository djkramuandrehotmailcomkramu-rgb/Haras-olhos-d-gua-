/* Pluviômetro — coleta de chuva por talhão. Dados ficam no aparelho (localStorage). */
(() => {
'use strict';

const KEY = 'pluvio.v1';
const FIELDS = window.TALHOES;
const FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHEV = '<svg class="chev" viewBox="0 0 8 13"><path d="m1.500 1.500 5 5-5 5"/></svg>';
const TICK = '<span class="check"><svg viewBox="0 0 12 12"><path d="m2 6.500 2.800 2.800L10 3.500"/></svg></span>';
const DROP = '<svg viewBox="0 0 24 24"><path d="M12 2.500c-3 3.800-6.500 7.300-6.500 11.200a6.500 6.500 0 0 0 13 0c0-3.900-3.500-7.400-6.500-11.200Z"/></svg>';

/* ---------- datas ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const br = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const brShort = s => s.slice(8) + '/' + s.slice(5, 7);
const longDay = s => {
  if (s === today()) return 'Hoje';
  if (s === addDays(today(), -1)) return 'Ontem';
  return toDate(s).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: s.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }).replace(/\./g, '');
};
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const parseMm = v => { const n = parseFloat(String(v).trim().replace(',', '.')); return isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 10) / 10 : null; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- estado ---------- */
function defaultSeason() { const d = new Date(); return `${d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1}-09-01`; }
function load() {
  const base = { settings: { farm: "Haras Olhos d'Água", user: '', season: defaultSeason(), lastBackup: 0 }, gauges: [], readings: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { settings: { ...base.settings, ...s.settings }, gauges: s.gauges || [], readings: s.readings || [] };
  } catch { return base; }
}
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('Sem espaço para salvar no aparelho'); } };
const ui = { tab: 'home', period: 'd7' };
const gauges = () => db.gauges.filter(g => !g.deleted).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
const readings = () => db.readings.filter(r => !r.deleted && GAUGE()[r.gaugeId]);
const GAUGE = () => Object.fromEntries(db.gauges.filter(g => !g.deleted).map(g => [g.id, g]));

const PERIODS = [['d1', 'Hoje'], ['d7', '7 dias'], ['d30', '30 dias'], ['safra', 'Safra']];
function range(p = ui.period) {
  const to = today();
  if (p === 'd1') return { from: to, to };
  if (p === 'd7') return { from: addDays(to, -6), to };
  if (p === 'd30') return { from: addDays(to, -29), to };
  return { from: db.settings.season > to ? to : db.settings.season, to };
}
const periodText = (p = ui.period) => { const { from, to } = range(p); return from === to ? br(to) : `${br(from)} a ${br(to)}`; };

/* ---------- cálculo ---------- */
function index() { // pluviômetro -> { data: mm }
  const m = {};
  for (const r of readings()) (m[r.gaugeId] ??= {})[r.date] = r.mm;
  return m;
}
const gaugesOf = fid => gauges().filter(g => g.fieldIds.includes(fid));
function fieldDays(fid, idx) { // chuva diária do talhão = média dos pluviômetros ligados que leram no dia
  const gs = gaugesOf(fid);
  if (!gs.length) return null;
  const acc = {};
  for (const g of gs) for (const [d, mm] of Object.entries(idx[g.id] || {})) (acc[d] ??= []).push(mm);
  const out = {};
  for (const d in acc) out[d] = acc[d].reduce((a, b) => a + b, 0) / acc[d].length;
  return out;
}
const sumRange = (days, from, to) => { let s = 0; for (const d in days) if (d >= from && d <= to) s += days[d]; return s; };
function stats(p = ui.period) {
  const { from, to } = range(p), idx = index();
  const rows = FIELDS.map(f => { const days = fieldDays(f.id, idx); return { f, days, mm: days ? sumRange(days, from, to) : null }; });
  const linked = rows.filter(r => r.mm != null);
  const area = linked.reduce((a, r) => a + r.f.ha, 0);
  const mean = area ? linked.reduce((a, r) => a + r.mm * r.f.ha, 0) / area : 0;
  const ranked = [...linked].sort((a, b) => b.mm - a.mm || a.f.name.localeCompare(b.f.name));
  const gaugeRows = gauges().map(g => ({ g, mm: sumRange(idx[g.id] || {}, from, to), n: Object.keys(idx[g.id] || {}).filter(d => d >= from && d <= to).length }));
  return { from, to, rows, linked, ranked, mean, area, rained: linked.filter(r => r.mm > 0).length, max: ranked[0]?.mm || 0, gaugeRows, idx };
}
const pct = (mm, mean) => mean > 0 ? Math.round(mm / mean * 100) + '% da média' : '—';

/* ---------- UI base ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
const buzz = () => navigator.vibrate?.(8);
const seg = (cur, act = 'period') => `<div class="seg">${PERIODS.map(([id, l]) => `<button data-act="${act}" data-id="${id}" class="${id === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const initials = n => (n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const head = (title, right = '') => `<div class="head"><div><div class="cap">${esc(db.settings.farm)}</div><h1>${title}</h1></div>${right}</div>`;
const shareBtn = '<button class="hbtn" data-act="share" aria-label="Compartilhar"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg></button>';

const sheets = [];
function openSheet(html, init) {
  const w = document.createElement('div');
  w.className = 'wrap';
  w.innerHTML = `<div class="back" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  $('#sheets').append(w); sheets.push(w);
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
  init?.(w);
  return w;
}
function closeSheet() {
  const w = sheets.pop(); if (!w) return;
  w.classList.remove('in'); setTimeout(() => w.remove(), 320);
}
const nav = (title, ok = 'OK', okAct = 'close', cancel = 'Cancelar') =>
  `<div class="nav"><button data-act="close">${cancel}</button><b>${title}</b><button data-act="${okAct}">${ok}</button></div>`;

/* ---------- telas ---------- */
function render() {
  $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const v = $('#view');
  v.innerHTML = ({ home: viewHome, map: viewMap, history: viewHistory, settings: viewSettings })[ui.tab]();
  if (ui.tab === 'map') initMap();
}

const emptyGauges = () => `<div class="card empty"><div class="ic">${DROP}</div><h3>Cadastre os pluviômetros</h3>
  <p>Informe cada pluviômetro da fazenda e quais talhões ele representa. Depois é só lançar a chuva do dia.</p>
  <button class="btn" data-act="gauge">Adicionar pluviômetro</button></div>`;

function viewHome() {
  const s = stats();
  const avatar = `<button class="avatar" data-tab="settings" aria-label="Ajustes">${esc(initials(db.settings.user))}</button>`;
  if (!gauges().length) return head('Chuva', avatar) + emptyGauges();
  const last = readings().reduce((m, r) => r.date > m ? r.date : m, '');
  const lastTxt = !last ? 'Sem leituras' : last === today() ? 'Hoje' : diffDays(last, today()) === 1 ? 'Ontem' : `Há ${diffDays(last, today())} dias`;
  const top = s.ranked[0];
  const rank = s.ranked.map((r, i) => `
    <button class="row" data-act="field" data-id="${r.f.id}">
      <span class="rank ${i < 3 && r.mm > 0 ? 'top' : ''}">${i + 1}</span>
      <div class="grow"><div class="t">${esc(r.f.name)}</div><div class="bar"><i style="width:${s.max ? r.mm / s.max * 100 : 0}%"></i></div></div>
      <div class="mm num"><b>${fmt(r.mm)}<small>mm</small></b><span>${pct(r.mm, s.mean)}</span></div>
    </button>`).join('');
  const none = s.rows.filter(r => r.mm == null);
  return head('Chuva', avatar) + seg(ui.period) + `
    <div class="card">
      <div class="hero"><div class="k">Chuva acumulada · média da fazenda</div>
        <div class="big num">${fmt(s.mean)}<small>mm</small></div><div class="sub">${periodText()}</div></div>
      <div class="stats">
        <div><b class="num">${s.linked.length ? Math.round(s.rained / s.linked.length * 100) : 0}%</b><span>Com chuva · ${s.rained} de ${s.linked.length}</span></div>
        <div><b class="num">${top && top.mm > 0 ? fmt(top.mm) + ' mm' : '—'}</b><span>${top && top.mm > 0 ? 'Maior · ' + esc(top.f.name) : 'Maior acumulado'}</span></div>
        <div><b>${lastTxt}</b><span>Última leitura</span></div>
      </div>
    </div>
    <div class="sect"><span>Onde mais choveu</span><span>${fmt(s.area)} ha</span></div>
    <div class="card">${rank || '<div class="row"><div class="grow s">Nenhum talhão vinculado a pluviômetro.</div></div>'}</div>
    ${none.length ? `<div class="foot">Sem pluviômetro: ${none.map(r => esc(r.f.name)).join(', ')}. Vincule em Ajustes.</div>` : ''}
    <div class="sect"><span>Pluviômetros</span></div>
    <div class="card">${s.gaugeRows.map(({ g, mm, n }) => `
      <button class="row" data-act="gauge" data-id="${g.id}"><div class="grow"><div class="t">${esc(g.name)}</div>
      <div class="s">${g.fieldIds.length} ${g.fieldIds.length === 1 ? 'talhão' : 'talhões'} · ${n} ${n === 1 ? 'leitura' : 'leituras'}</div></div>
      <div class="mm num"><b>${fmt(mm)}<small>mm</small></b></div>${CHEV}</button>`).join('')}</div>`;
}

/* ---------- mapa ---------- */
const K = Math.cos(-14.92 * Math.PI / 180) * 111320, KY = 110540;
const proj = ([lon, lat]) => [(lon + 51.29) * K, -(lat + 14.92) * KY];
const GEO = FIELDS.map(f => {
  const rings = f.rings.map(r => r.map(proj));
  let a = 0, cx = 0, cy = 0; const r = rings[0];
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const c = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += c; cx += (r[j][0] + r[i][0]) * c; cy += (r[j][1] + r[i][1]) * c; }
  return { id: f.id, d: rings.map(r => 'M' + r.map(p => p[0].toFixed(0) + ' ' + p[1].toFixed(0)).join('L') + 'Z').join(''), c: [cx / (3 * a), cy / (3 * a)], pts: rings.flat() };
});
const shortName = n => n.replace('Condomínio ', 'C').replace('IT ', '');

function viewMap() {
  const s = stats();
  const max = Math.max(s.max, 1);
  const by = Object.fromEntries(s.rows.map(r => [r.f.id, r]));
  const paths = GEO.map(g => {
    const r = by[g.id];
    return r.mm == null ? `<path class="f none" data-id="${g.id}" d="${g.d}"/>`
      : `<path class="f" data-id="${g.id}" d="${g.d}" fill="rgba(var(--rain),${(0.08 + 0.87 * r.mm / max).toFixed(2)})"/>`;
  }).join('');
  const labels = GEO.map(g => {
    const r = by[g.id];
    return `<text x="${g.c[0].toFixed(0)}" y="${g.c[1].toFixed(0)}">${esc(shortName(r.f.name))}${r.mm != null ? `<tspan class="m" x="${g.c[0].toFixed(0)}" dy="1.150em">${fmt(r.mm)}</tspan>` : ''}</text>`;
  }).join('');
  return head('Mapa', shareBtn) + seg(ui.period) + `
    <div class="card mapcard">
      <svg class="map" role="img" aria-label="Mapa dos talhões">${paths}<g id="labels">${labels}</g></svg>
      <div class="legend">Acumulado (mm)<i></i><div class="num"><span>0</span><span>${fmt(max)}</span></div></div>
      <button class="mapbtn" data-act="mapreset" aria-label="Centralizar mapa"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
    </div>
    <div class="foot">Toque em um talhão para ver os detalhes. Arraste e use dois dedos para aproximar.</div>`;
}
let mapReset = () => {};
function initMap() {
  const svg = $('svg.map'); if (!svg) return;
  const box = svg.getBoundingClientRect(), all = GEO.flatMap(g => g.pts);
  let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
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
  const f = FIELD[id], idx = index(), days = fieldDays(id, idx), gs = gaugesOf(id);
  buzz();
  if (!days) {
    return openSheet(nav(esc(f.name), 'OK', 'close', '') + `<div class="body"><div class="card empty"><div class="ic">${DROP}</div><h3>Sem pluviômetro</h3>
      <p>${esc(f.name)} (${fmt(f.ha)} ha) ainda não está vinculado a nenhum pluviômetro.</p><button class="btn" data-act="go-settings">Vincular em Ajustes</button></div></div>`);
  }
  const tot = PERIODS.map(([p, l]) => { const r = range(p); return `<div><b class="num">${fmt(sumRange(days, r.from, r.to))}</b><span>${l}</span></div>`; }).join('');
  const t = today(), from = addDays(t, -29);
  const vals = Array.from({ length: 30 }, (_, i) => days[addDays(from, i)] || 0), max = Math.max(...vals, 1);
  const W = 320, H = 110, bw = W / 30;
  const bars = vals.map((v, i) => v > 0 ? `<rect x="${(i * bw + 1.500).toFixed(1)}" y="${(H - 18 - v / max * (H - 34)).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${(v / max * (H - 34)).toFixed(1)}" rx="2"><title>${brShort(addDays(from, i))}: ${fmt(v)} mm</title></rect>` : '').join('');
  const ticks = [0, 7, 14, 21, 29].map(i => `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${brShort(addDays(from, i))}</text>`).join('');
  const rainDays = Object.keys(days).filter(d => days[d] > 0).sort();
  const lastRain = rainDays.at(-1), sr = range('safra');
  const season = Object.entries(days).filter(([d]) => d >= sr.from && d <= sr.to);
  const best = season.reduce((m, e) => e[1] > m[1] ? e : m, ['', 0]);
  const s = stats('safra'), me = s.rows.find(r => r.f.id === id);
  const pos = s.ranked.findIndex(r => r.f.id === id) + 1;
  openSheet(nav(esc(f.name), 'OK', 'close', '') + `<div class="body">
    <div class="sect"><span>Chuva acumulada (mm)</span><span>${fmt(f.ha)} ha</span></div>
    <div class="card"><div class="grid4">${tot}</div></div>
    <div class="sect"><span>Últimos 30 dias</span><span class="num">máx. ${fmt(Math.max(...vals))} mm</span></div>
    <div class="card chart"><svg viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${H - 17.500}" y2="${H - 17.500}"/>${bars}${ticks}</svg></div>
    <div class="sect"><span>Na safra</span></div>
    <div class="card">
      <div class="row"><div class="grow t">Comparado à fazenda</div><div class="v num">${pct(me.mm, s.mean)}</div></div>
      <div class="row"><div class="grow t">Posição no ranking</div><div class="v num">${pos}º de ${s.ranked.length}</div></div>
      <div class="row"><div class="grow t">Dias com chuva</div><div class="v num">${season.filter(e => e[1] > 0).length}</div></div>
      <div class="row"><div class="grow t">Maior chuva em um dia</div><div class="v num">${best[1] ? `${fmt(best[1])} mm · ${brShort(best[0])}` : '—'}</div></div>
      <div class="row"><div class="grow t">Última chuva</div><div class="v">${lastRain ? `${longDay(lastRain)}${diffDays(lastRain, t) > 1 ? ` · há ${diffDays(lastRain, t)} dias` : ''}` : '—'}</div></div>
    </div>
    <div class="sect"><span>${gs.length > 1 ? 'Pluviômetros (média)' : 'Pluviômetro'}</span></div>
    <div class="card">${gs.map(g => `<div class="row"><div class="grow t">${esc(g.name)}</div></div>`).join('')}</div>
  </div>`);
}

/* ---------- lançar leitura ---------- */
function openLaunch(date = today()) {
  const gs = gauges();
  if (!gs.length) { ui.tab = 'home'; render(); return openGauge(); }
  if (!db.settings.user) return askUser(() => openLaunch(date));
  const rowsFor = d => gs.map(g => {
    const r = db.readings.find(r => r.id === g.id + '|' + d && !r.deleted);
    return `<div class="row"><div class="grow"><div class="t">${esc(g.name)}</div><div class="s">${g.fieldIds.map(i => shortName(FIELD[i]?.name || '')).join(' · ') || 'Sem talhões'}</div></div>
      <input class="mmin num" inputmode="decimal" enterkeyhint="next" placeholder="—" data-g="${g.id}" value="${r ? String(r.mm).replace('.', ',') : ''}" aria-label="Chuva em ${esc(g.name)}, em milímetros"><span class="unit">mm</span></div>`;
  }).join('');
  openSheet(nav('Lançar chuva', 'Salvar', 'save-launch') + `<div class="body">
    <div class="card"><div class="row"><label class="grow t" for="ldate">Data</label><input type="date" id="ldate" value="${date}" max="${today()}"></div></div>
    <div class="sect"><span>Pluviômetros</span><span>${esc(db.settings.user)}</span></div>
    <div class="card" id="lrows">${rowsFor(date)}</div>
    <div class="foot">Deixe em branco o que não foi lido. Use 0 para registrar que não choveu.</div>
    <div class="sect"><span>Observação</span></div>
    <div class="card"><div class="row"><input id="lnote" style="text-align:left" placeholder="Opcional" maxlength="120"></div></div>
  </div>`, w => {
    $('#ldate', w).addEventListener('change', e => { if (e.target.value) $('#lrows', w).innerHTML = rowsFor(e.target.value); });
    setTimeout(() => $('.mmin', w)?.focus(), 380);
  });
}
function saveLaunch(w) {
  const date = $('#ldate', w).value;
  if (!date || date > today()) return toast('Data inválida');
  const note = $('#lnote', w).value.trim(), now = Date.now(); let n = 0, bad = false;
  $$('.mmin', w).forEach(inp => {
    if (inp.value.trim() === '') return;
    const mm = parseMm(inp.value); if (mm == null) { bad = true; return; }
    putReading({ id: inp.dataset.g + '|' + date, gaugeId: inp.dataset.g, date, mm, note, user: db.settings.user, updatedAt: now });
    n++;
  });
  if (bad) return toast('Confira os valores em mm');
  if (!n) return toast('Informe ao menos uma leitura');
  save(); closeSheet(); buzz(); render();
  toast(n === 1 ? 'Leitura salva' : `${n} leituras salvas`);
}
function putReading(r) {
  const i = db.readings.findIndex(x => x.id === r.id);
  if (i >= 0) db.readings[i] = { ...db.readings[i], ...r, deleted: false, note: r.note || db.readings[i].note || '' };
  else db.readings.push(r);
}

/* ---------- histórico ---------- */
function viewHistory() {
  const { from, to } = range(), G = GAUGE();
  const list = readings().filter(r => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date) || G[a.gaugeId].name.localeCompare(G[b.gaugeId].name, 'pt-BR', { numeric: true }));
  const h = head('Histórico', shareBtn) + seg(ui.period);
  if (!gauges().length) return h + emptyGauges();
  if (!list.length) return h + `<div class="card empty"><div class="ic">${DROP}</div><h3>Sem leituras no período</h3><p>${periodText()}</p><button class="btn" data-act="launch">Lançar chuva</button></div>`;
  const days = {};
  for (const r of list) (days[r.date] ??= []).push(r);
  return h + Object.entries(days).map(([d, rs], i) => `
    <div class="day" ${i ? '' : 'style="margin-top:8px"'}><span>${longDay(d)} · ${brShort(d)}</span><span class="num">média ${fmt(rs.reduce((a, r) => a + r.mm, 0) / rs.length)} mm</span></div>
    <div class="card">${rs.map(r => `<button class="row" data-act="reading" data-id="${esc(r.id)}">
      <div class="grow"><div class="t">${esc(G[r.gaugeId].name)}</div><div class="s">${esc(r.user || '—')}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
      <div class="mm num"><b>${fmt(r.mm)}<small>mm</small></b></div>${CHEV}</button>`).join('')}</div>`).join('');
}
function openReading(id) {
  const r = db.readings.find(x => x.id === id); if (!r) return;
  openSheet(nav('Leitura', 'Salvar', 'save-reading') + `<div class="body" data-id="${esc(id)}">
    <div class="card">
      <div class="row"><div class="grow t">Pluviômetro</div><div class="v">${esc(GAUGE()[r.gaugeId]?.name)}</div></div>
      <div class="row"><div class="grow t">Data</div><div class="v num">${br(r.date)}</div></div>
      <div class="row"><div class="grow t">Chuva</div><input class="mmin num" id="rmm" inputmode="decimal" value="${String(r.mm).replace('.', ',')}" aria-label="Chuva em milímetros"><span class="unit">mm</span></div>
      <div class="row"><input id="rnote" style="text-align:left" placeholder="Observação" maxlength="120" value="${esc(r.note)}"></div>
    </div>
    <div class="foot">Lançado por ${esc(r.user || '—')} · alterado em ${new Date(r.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
    <div class="sect"></div><div class="card"><button class="row red" data-act="del-reading"><div class="grow t" style="text-align:center">Apagar leitura</div></button></div>
  </div>`);
}

/* ---------- ajustes ---------- */
function viewSettings() {
  const s = db.settings, gs = gauges();
  const free = FIELDS.filter(f => !gaugesOf(f.id).length).length;
  return head('Ajustes') + `
    <div class="card">
      <div class="row"><label class="t" for="sfarm">Fazenda</label><input id="sfarm" data-set="farm" value="${esc(s.farm)}" maxlength="40" placeholder="Nome da fazenda"></div>
      <div class="row"><label class="t" for="suser">Seu nome</label><input id="suser" data-set="user" value="${esc(s.user)}" maxlength="24" placeholder="Quem lança as leituras"></div>
      <div class="row"><label class="grow t" for="sseason">Início da safra</label><input type="date" id="sseason" data-set="season" value="${s.season}" max="${today()}"></div>
    </div>
    <div class="foot">Seu nome fica gravado em cada leitura que você lançar.</div>

    <div class="sect"><span>Pluviômetros</span><span>${gs.length}</span></div>
    <div class="card">${gs.map(g => `<button class="row" data-act="gauge" data-id="${g.id}"><div class="grow"><div class="t">${esc(g.name)}</div>
      <div class="s">${g.fieldIds.map(i => FIELD[i]?.name).filter(Boolean).join(', ') || 'Nenhum talhão vinculado'}</div></div>${CHEV}</button>`).join('')}
      <button class="row blue" data-act="gauge"><div class="grow t">Adicionar pluviômetro</div></button></div>
    <div class="foot">${FIELDS.length} talhões · ${fmt(FIELDS.reduce((a, f) => a + f.ha, 0))} ha${free ? ` · ${free} sem pluviômetro` : ''}</div>

    <div class="sect"><span>Relatórios</span></div>
    <div class="card"><button class="row blue" data-act="share"><div class="grow t">Enviar no WhatsApp, PDF ou planilha</div>${CHEV}</button></div>

    <div class="sect"><span>Backup</span></div>
    <div class="card">
      <button class="row blue" data-act="backup"><div class="grow t">Fazer backup</div></button>
      <button class="row blue" data-act="restore"><div class="grow t">Importar backup</div></button>
    </div>
    <div class="foot">${s.lastBackup ? 'Último backup: ' + new Date(s.lastBackup).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '. ' : ''}Os dados ficam neste aparelho. Para juntar as leituras de várias pessoas, cada um envia o backup e o outro importa: as leituras são mescladas, sem duplicar.</div>

    <div class="sect"></div>
    <div class="card"><button class="row red" data-act="wipe"><div class="grow t">Apagar todas as leituras</div></button></div>
    <div class="foot">Pluviômetro · versão 1.0</div>`;
}
function askUser(then) {
  openSheet(nav('Quem está lançando?', 'Continuar', 'save-user') + `<div class="body">
    <div class="card"><div class="row"><input id="uname" style="text-align:left" placeholder="Seu nome" maxlength="24" autocomplete="given-name"></div></div>
    <div class="foot">Aparece em cada leitura e nos relatórios. Pode ser alterado em Ajustes.</div></div>`, w => {
    w.then = then; setTimeout(() => $('#uname', w).focus(), 380);
  });
}
function openGauge(id) {
  const g = db.gauges.find(x => x.id === id) || { id: '', name: '', fieldIds: [] };
  const owner = fid => gauges().find(x => x.id !== g.id && x.fieldIds.includes(fid));
  openSheet(nav(id ? 'Pluviômetro' : 'Novo pluviômetro', 'Salvar', 'save-gauge') + `<div class="body" data-id="${g.id}">
    <div class="card"><div class="row"><input id="gname" style="text-align:left" placeholder="Nome (ex.: Sede, Retiro, IT 10)" maxlength="30" value="${esc(g.name)}"></div></div>
    <div class="sect"><span>Talhões que este pluviômetro representa</span></div>
    <div class="card">${FIELDS.map(f => { const o = owner(f.id); return `<button class="row ${g.fieldIds.includes(f.id) ? 'sel' : ''}" data-act="toggle" data-f="${f.id}" aria-pressed="${g.fieldIds.includes(f.id)}">${TICK}
      <div class="grow"><div class="t">${esc(f.name)}</div>${o ? `<div class="s">Também em ${esc(o.name)}</div>` : ''}</div><div class="v num">${fmt(f.ha)} ha</div></button>`; }).join('')}</div>
    <div class="foot">Se um talhão tiver mais de um pluviômetro, o app usa a média deles.</div>
    ${id ? '<div class="sect"></div><div class="card"><button class="row red" data-act="del-gauge"><div class="grow t" style="text-align:center">Apagar pluviômetro</div></button></div>' : ''}
  </div>`, w => { if (!id) setTimeout(() => $('#gname', w).focus(), 380); });
}

/* ---------- relatórios ---------- */
function openShare() {
  let p = ui.period;
  const body = () => `${seg(p, 'share-period')}<div class="foot" style="margin:-6px 4px 0;text-align:center">${periodText(p)}</div>
    <div class="stack">
      <button class="btn wide wa" data-act="wa">Enviar no WhatsApp</button>
      <button class="btn wide" data-act="pdf">Salvar em PDF</button>
      <button class="btn wide tint" data-act="csv">Exportar planilha (CSV)</button>
    </div>`;
  openSheet(nav('Relatório', 'OK', 'close', '') + `<div class="body" id="sharebody">${body()}</div>`, w => {
    w.period = () => p;
    w.setPeriod = v => { p = v; $('#sharebody', w).innerHTML = body(); };
  });
}
const sharePeriod = () => sheets.at(-1)?.period?.() || ui.period;
const periodLabel = p => PERIODS.find(x => x[0] === p)[1];

function waText(p) {
  const s = stats(p), G = GAUGE();
  const L = [`🌧️ *Chuva · ${db.settings.farm}*`, `${periodLabel(p)}: ${periodText(p)}`, ''];
  L.push(`*Média da fazenda:* ${fmt(s.mean)} mm`);
  L.push(`*Talhões com chuva:* ${s.rained} de ${s.linked.length}${s.linked.length ? ` (${Math.round(s.rained / s.linked.length * 100)}%)` : ''}`, '');
  L.push('*Acumulado por talhão*');
  s.ranked.forEach((r, i) => L.push(`${i + 1}. ${r.f.name}: ${fmt(r.mm)} mm`));
  const rs = readings().filter(r => r.date >= s.from && r.date <= s.to && r.mm > 0).sort((a, b) => b.date.localeCompare(a.date));
  if (rs.length && p !== 'safra') {
    L.push('', '*Leituras*');
    const byDay = {};
    for (const r of rs) (byDay[r.date] ??= []).push(`${G[r.gaugeId].name} ${fmt(r.mm)}`);
    for (const d in byDay) L.push(`${brShort(d)}: ${byDay[d].join(' · ')} mm`);
  }
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
  const s = stats(p), G = GAUGE(), doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const blue = [0, 122, 255], gray = [110, 110, 115];
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(0).text('Relatório de chuva', 14, 20);
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...gray);
  doc.text(`${db.settings.farm}  ·  ${periodLabel(p)}: ${periodText(p)}`, 14, 27);
  doc.setDrawColor(210).line(14, 31, 196, 31);
  const box = (x, label, value) => { doc.setFontSize(9).setTextColor(...gray).text(label, x, 38); doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(0).text(value, x, 45); doc.setFont('helvetica', 'normal'); };
  box(14, 'Média da fazenda', `${fmt(s.mean)} mm`);
  box(70, 'Talhões com chuva', `${s.rained} de ${s.linked.length}`);
  box(126, 'Maior acumulado', s.ranked[0] && s.max > 0 ? `${s.ranked[0].f.name} · ${fmt(s.max)} mm` : '—');
  const table = (startY, title, headRow, body, columnStyles) => {
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0).text(title, 14, startY);
    doc.autoTable({ startY: startY + 3, head: [headRow], body, theme: 'striped', margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2 }, headStyles: { fillColor: blue, textColor: 255 }, alternateRowStyles: { fillColor: [245, 245, 248] }, columnStyles });
    return doc.lastAutoTable.finalY;
  };
  const num = { halign: 'right' };
  let y = table(56, 'Acumulado por talhão', ['#', 'Talhão', 'Área (ha)', 'Chuva (mm)', '% da média', 'Pluviômetro'],
    [...s.ranked.map((r, i) => [i + 1, r.f.name, fmt(r.f.ha), fmt(r.mm), s.mean > 0 ? Math.round(r.mm / s.mean * 100) + '%' : '—', gaugesOf(r.f.id).map(g => g.name).join(', ')]),
     ...s.rows.filter(r => r.mm == null).map(r => ['—', r.f.name, fmt(r.f.ha), '—', '—', 'Sem pluviômetro'])],
    { 0: { cellWidth: 10 }, 2: num, 3: { ...num, fontStyle: 'bold' }, 4: num });
  const rs = readings().filter(r => r.date >= s.from && r.date <= s.to).sort((a, b) => b.date.localeCompare(a.date) || G[a.gaugeId].name.localeCompare(G[b.gaugeId].name));
  if (rs.length) {
    if (y > 240) { doc.addPage(); y = 10; }
    table(y + 12, 'Leituras dos pluviômetros', ['Data', 'Pluviômetro', 'Chuva (mm)', 'Responsável', 'Observação'],
      rs.map(r => [br(r.date), G[r.gaugeId].name, fmt(r.mm), r.user || '', r.note || '']), { 2: { ...num, fontStyle: 'bold' } });
  }
  const n = doc.getNumberOfPages(), stamp = `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${db.settings.user ? ' por ' + db.settings.user : ''}`;
  for (let i = 1; i <= n; i++) { doc.setPage(i).setFontSize(8).setTextColor(...gray); doc.text(stamp, 14, 289); doc.text(`${i} / ${n}`, 196, 289, { align: 'right' }); }
  return doc.output('blob');
}
function makeCsv(p) {
  const { from, to } = range(p), G = GAUGE(), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Data', 'Pluviômetro', 'Chuva (mm)', 'Talhões', 'Responsável', 'Observação']];
  readings().filter(r => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date))
    .forEach(r => rows.push([br(r.date), G[r.gaugeId].name, String(r.mm).replace('.', ','), G[r.gaugeId].fieldIds.map(i => FIELD[i]?.name).join(', '), r.user, r.note]));
  return new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
}
const fileStamp = p => { const r = range(p); return `${r.from}_a_${r.to}`; };

/* ---------- backup ---------- */
async function backup() {
  const blob = new Blob([JSON.stringify({ app: 'pluviometro', version: 1, exportedAt: new Date().toISOString(), by: db.settings.user, ...db })], { type: 'application/json' });
  if (await deliver(blob, `backup-chuva-${today()}.json`, 'Backup de chuva')) { db.settings.lastBackup = Date.now(); save(); render(); toast('Backup gerado'); }
}
function mergeList(mine, theirs) {
  let n = 0; const map = new Map(mine.map(x => [x.id, x]));
  for (const t of theirs || []) {
    if (!t?.id) continue;
    const m = map.get(t.id);
    if (!m || (t.updatedAt || 0) > (m.updatedAt || 0)) { map.set(t.id, t); if (!t.deleted) n++; }
  }
  return [[...map.values()], n];
}
function restore(text) {
  let d; try { d = JSON.parse(text); } catch { return toast('Arquivo inválido'); }
  if (d?.app !== 'pluviometro' || !Array.isArray(d.readings)) return toast('Este arquivo não é um backup do app');
  const ok = d.readings.every(r => r.id && r.gaugeId && /^\d{4}-\d\d-\d\d$/.test(r.date) && typeof r.mm === 'number') && (d.gauges || []).every(g => g.id && Array.isArray(g.fieldIds));
  if (!ok) return toast('Backup corrompido');
  const [gs] = mergeList(db.gauges, d.gauges), [rs, n] = mergeList(db.readings, d.readings);
  db.gauges = gs; db.readings = rs;
  if (!db.readings.length && !db.settings.user && d.settings) db.settings = { ...db.settings, farm: d.settings.farm || db.settings.farm, season: d.settings.season || db.settings.season };
  save(); render(); toast(n ? `${n} ${n === 1 ? 'leitura importada' : 'leituras importadas'}` : 'Tudo já estava atualizado');
}

/* ---------- eventos ---------- */
const actions = {
  close: closeSheet,
  period: el => { ui.period = el.dataset.id; render(); },
  launch: () => openLaunch(),
  field: el => openField(el.dataset.id),
  gauge: el => openGauge(el.dataset.id),
  reading: el => openReading(el.dataset.id),
  share: openShare,
  mapreset: () => mapReset(),
  'go-settings': () => { closeSheet(); ui.tab = 'settings'; render(); },
  'share-period': el => sheets.at(-1).setPeriod(el.dataset.id),
  toggle: el => { el.classList.toggle('sel'); el.setAttribute('aria-pressed', el.classList.contains('sel')); },
  'save-launch': (el, w) => saveLaunch(w),
  'save-user': (el, w) => {
    const n = $('#uname', w).value.trim(); if (!n) return toast('Informe seu nome');
    db.settings.user = n; save(); const then = w.then; closeSheet(); render(); then?.();
  },
  'save-gauge': (el, w) => {
    const name = $('#gname', w).value.trim(), id = $('.body', w).dataset.id;
    if (!name) return toast('Dê um nome ao pluviômetro');
    if (gauges().some(g => g.id !== id && g.name.toLowerCase() === name.toLowerCase())) return toast('Já existe um pluviômetro com esse nome');
    const fieldIds = $$('.row.sel', w).map(r => r.dataset.f);
    if (!fieldIds.length) return toast('Selecione ao menos um talhão');
    const g = { id: id || uid(), name, fieldIds, updatedAt: Date.now() };
    const i = db.gauges.findIndex(x => x.id === g.id);
    i >= 0 ? db.gauges[i] = g : db.gauges.push(g);
    save(); closeSheet(); render(); toast('Pluviômetro salvo');
  },
  'del-gauge': (el, w) => {
    const g = db.gauges.find(x => x.id === $('.body', w).dataset.id);
    const n = db.readings.filter(r => r.gaugeId === g.id && !r.deleted).length;
    if (!confirm(`Apagar "${g.name}"${n ? ` e suas ${n} leituras` : ''}?`)) return;
    const now = Date.now(); g.deleted = true; g.updatedAt = now;
    db.readings.forEach(r => { if (r.gaugeId === g.id) { r.deleted = true; r.updatedAt = now; } });
    save(); closeSheet(); render(); toast('Pluviômetro apagado');
  },
  'save-reading': (el, w) => {
    const r = db.readings.find(x => x.id === $('.body', w).dataset.id), mm = parseMm($('#rmm', w).value);
    if (mm == null) return toast('Confira o valor em mm');
    Object.assign(r, { mm, note: $('#rnote', w).value.trim(), updatedAt: Date.now() });
    save(); closeSheet(); render(); toast('Leitura atualizada');
  },
  'del-reading': (el, w) => {
    if (!confirm('Apagar esta leitura?')) return;
    const r = db.readings.find(x => x.id === $('.body', w).dataset.id);
    r.deleted = true; r.updatedAt = Date.now(); save(); closeSheet(); render(); toast('Leitura apagada');
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
    if (!confirm(`Apagar as ${n} leituras deste aparelho? Faça um backup antes. Esta ação não pode ser desfeita.`)) return;
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
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.classList?.contains('mmin')) {
    const all = $$('.mmin', e.target.closest('.wrap')), i = all.indexOf(e.target);
    all[i + 1] ? all[i + 1].focus() : e.target.blur();
  }
});
$('#file').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(await f.text()); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => ui.tab === 'map' && !sheets.length && render(), 200); });

render();
if (!db.settings.user) askUser();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.();
})();
