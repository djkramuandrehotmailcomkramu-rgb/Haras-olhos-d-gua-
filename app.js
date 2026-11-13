/* Pluviômetro — chuva lançada por talhão. Os dados ficam no aparelho (localStorage). */
(() => {
'use strict';

const KEY = 'pluvio.v2';
// Cadastro: somente os 34 pontos que têm pluviômetro (os ids antigos são mantidos para não perder leituras).
const FIELDS = [['armazem', 'Armazém'],
  ['condominio01', 'Condomínio 01'], ['condominio02', 'Condomínio 02'], ['condominio03', 'Condomínio 03'],
  ['retiro01', 'Retiro 01'], ['retiro02', 'Retiro 02'], ['retiro03', 'Retiro 03'],
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
    .map(n => [(n === 8 || n >= 22 ? 'th' : 'it') + String(n).padStart(2, '0'), 'TH ' + String(n).padStart(2, '0')])]
  .map(([id, name]) => ({ id, name }));
const FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]));
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
  $('#sheets').append(w); sheets.push(w); w.openedAt = Date.now();
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
  $('#view').innerHTML = ({ home: viewHome, history: viewHistory, more: viewMore })[ui.tab]();
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

/* ---------- detalhe do talhão ---------- */
function openField(id) {
  const f = FIELD[id], days = index()[id] || {}, t = today();
  buzz();
  const tot = PERIODS.map(([p, l]) => { const r = range(p); return `<div><b>${fmt(sumRange(days, r.from, r.to))}</b><span>${l}</span></div>`; }).join('');
  const rainDays = Object.keys(days).filter(d => days[d] > 0).sort(), last = rainDays.at(-1), sr = range('safra');
  const season = Object.entries(days).filter(([d]) => d >= sr.from && d <= sr.to);
  const best = season.reduce((m, e) => e[1] > m[1] ? e : m, ['', 0]);
  const s = stats('safra'), pos = s.ranked.findIndex(r => r.f.id === id) + 1;
  openSheet(nav(esc(f.name), 'Pluviômetro') + `<div class="body">
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
      <div class="s">${rs.length} ${rs.length === 1 ? 'talhão' : 'talhões'}${top.mm > 0 ? ` · maior: ${esc(FIELD[top.fieldId].name)}, ${fmt(top.mm)} mm` : ' · sem chuva'}</div></div>
      <div class="mm"><b>${fmt(mean)}<small>mm</small></b></div>${I.chev}</button>`;
  }).join('')}</div><p class="note">Média da fazenda em cada dia. Toque em um dia para ver e corrigir os talhões.</p>`;
}

/* ---------- mais ---------- */
function viewMore() {
  const s = db.settings;
  return head('Mais') + `
    <div class="panel">
      <button class="row" data-act="share"><div class="grow"><div class="t">Enviar relatório</div><div class="s">WhatsApp, PDF ou Excel</div></div>${I.chev}</button>
      <button class="row" data-act="backup"><div class="grow"><div class="t">Fazer backup</div><div class="s">${s.lastBackup ? 'Último: ' + new Date(s.lastBackup).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Salva todas as leituras em um arquivo'}</div></div>${I.chev}</button>
      <button class="row" data-act="restore"><div class="grow"><div class="t">Importar backup</div><div class="s">Junta as leituras de outro celular, sem duplicar</div></div>${I.chev}</button>
    </div>
    <div class="sect"><h2>Fazenda</h2><span>${FIELDS.length} pluviômetros</span></div>
    <div class="panel">
      <div class="row"><label class="t" for="sfarm">Nome</label><input id="sfarm" data-set="farm" value="${esc(s.farm)}" maxlength="40" placeholder="Nome da fazenda"></div>
      <div class="row"><label class="t" for="suser">Quem lança</label><input id="suser" data-set="user" value="${esc(s.user)}" maxlength="24" placeholder="Seu nome"></div>
      <div class="row"><label class="grow t" for="sseason">Início da safra</label><input type="date" id="sseason" data-set="season" value="${s.season}" max="${today()}"></div>
    </div>
    <p class="note">As coletas da planilha (safras 2024/25 e 2026/27, até ${window.COLETAS ? brShort(Object.keys(window.COLETAS.days).at(-1)) : ''}) já vêm no app. As novas leituras ficam neste celular. Para juntar com os outros, um faz o backup, envia o arquivo e o outro importa.</p>
    <div class="sect"></div>
    <div class="panel"><button class="row red" data-act="wipe"><div class="grow t">Apagar todas as leituras</div></button></div>
    <p class="note">Pluviômetro · versão 2.3</p>`;
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
      <button class="pill" data-act="xlsx">Exportar para Excel</button>
      <button class="pill ghost" data-act="csv">Lista simples (CSV)</button>
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
  let y = table(64, 'Chuva por talhão', ['#', 'Pluviômetro', 'Chuva (mm)', 'Comparado à média', 'Dias lidos'],
    s.ranked.map((r, i) => [i + 1, r.f.name, r.n ? fmt(r.mm) : '-', r.n && s.mean > 0 ? `${r.mm >= s.mean ? '+' : ''}${Math.round((r.mm / s.mean - 1) * 100)}%` : '-', r.n]),
    { 0: { cellWidth: 10 }, 2: { ...num, fontStyle: 'bold' }, 3: num, 4: num });
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
  const rows = [['Data', 'Pluviômetro', 'Chuva (mm)', 'Quem lançou']];
  readings().filter(r => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date) || FIELDS.indexOf(FIELD[a.fieldId]) - FIELDS.indexOf(FIELD[b.fieldId]))
    .forEach(r => rows.push([br(r.date), FIELD[r.fieldId].name, String(r.mm).replace('.', ','), r.user]));
  return new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
}
/* Excel (.xlsx) gerado no próprio aparelho, sem biblioteca: linhas = pluviômetros, colunas = datas, primeira linha e duas primeiras colunas congeladas. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files, type) { // zip sem compressão
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    const head = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, data);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + data.length;
  }
  const size = cen.reduce((a, b) => a + b.length, 0);
  parts.push(...cen, new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(size), ...u32(off), 0, 0]));
  return new Blob(parts, { type });
}
function makeXlsx(p) {
  const s = stats(p);
  const dates = [...new Set(readings().filter(r => r.date >= s.from && r.date <= s.to).map(r => r.date))].sort();
  if (!dates.length) return null;
  const col = i => { let n = i + 1, c = ''; while (n) { c = String.fromCharCode(65 + (n - 1) % 26) + c; n = Math.floor((n - 1) / 26); } return c; };
  const x = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const r1 = v => Math.round(v * 10) / 10;
  const txt = (r, c, v, st) => `<c r="${col(c)}${r}" s="${st}" t="inlineStr"><is><t>${x(v)}</t></is></c>`;
  const num = (r, c, v, st) => `<c r="${col(c)}${r}" s="${st}"><v>${v}</v></c>`;
  const rows = [`<row r="1" ht="24" customHeight="1">${txt(1, 0, 'Pluviômetro', 1)}${txt(1, 1, 'Acumulado (mm)', 1)}${dates.map((d, i) => txt(1, i + 2, brShort(d), 1)).join('')}</row>`];
  s.rows.forEach((r, k) => {
    const n = k + 2;
    rows.push(`<row r="${n}">${txt(n, 0, r.f.name, 3)}${r.n ? num(n, 1, r1(r.mm), 4) : txt(n, 1, '', 4)}${dates.map((d, i) => { const v = s.idx[r.f.id]?.[d]; return v == null ? '' : num(n, i + 2, v, 2); }).join('')}</row>`);
  });
  const f = s.rows.length + 2;
  rows.push(`<row r="${f}">${txt(f, 0, 'Média da fazenda', 5)}${num(f, 1, r1(s.mean), 5)}${dates.map((d, i) => num(f, i + 2, r1(s.farm[d] ?? 0), 5)).join('')}</row>`);
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const sheet = `${head}<worksheet ${ns}><sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="topRight" activeCell="C1" sqref="C1"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="${dates.length + 2}" width="8.5" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const styles = `${head}<styleSheet ${ns}><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    { name: '[Content_Types].xml', data: `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${head}<workbook ${ns} xmlns:r="${rel}"><sheets><sheet name="Chuva" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
  xlsx: () => { const p = sharePeriod(), b = makeXlsx(p); if (!b) return toast('Não há leituras neste período'); deliver(b, `chuva-${fileStamp(p)}.xlsx`, 'Chuva (Excel)'); },
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
  if (el.classList.contains('back') && Date.now() - (el.parentNode.openedAt || 0) < 400) return; // ainda é o toque que abriu a folha
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

render();
if (!db.settings.user) askUser();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.();
})();
