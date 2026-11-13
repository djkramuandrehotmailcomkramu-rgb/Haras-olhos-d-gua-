'use strict';
/* Controle de Safra — Fazenda Lagoa Formosa. PWA em JS puro + Supabase (chave pública; a segurança está no RLS do banco). */
const SB_URL = 'https://phkrppopkpfwuyvreqeh.supabase.co';
const SB_KEY = 'sb_publishable_NpqYJ8BrFKLLvdXYuXtyWQ_JW3-ubWb';
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const n1 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const agoraHora = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const brData = s => s ? s.split('-').reverse().join('/') : '';
const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const normPlaca = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtPlaca = p => { const n = normPlaca(p); return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(n) ? n.slice(0, 3) + '-' + n.slice(3) : n; };
const maskMilhar = v => { const d = String(v || '').replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
const maskDec = v => { let t = String(v || '').replace(/[^0-9.,]/g, '').replace('.', ','); if (/,/.test(t)) { const [a, ...b] = t.split(','); return a.slice(0, 3) + ',' + b.join('').replace(/\D/g, '').slice(0, 2); } return t.length >= 3 ? t.slice(0, 2) + ',' + t.slice(2, 4) : t; };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

const S = {
  user: null, perfil: null, safra: null, talhoes: [], variedades: [], params: null, veiculos: [], fech: [], lt: ls.get('cs_ult', {}), cargas: [], fila: ls.get('cs_fila', []),
  tab: ls.get('cs_tab', 'lancar'), online: navigator.onLine, periodo: '7d', fTalhao: '', dia: hoje(), sync: false, erroLogin: '', entrando: false, usuarios: []
};

/* ---------- Mensagens ---------- */
let tt;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(tt); tt = setTimeout(() => t.className = '', 2600);
}
function traduz(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos. Confira e tente de novo.';
  if (/Apenas o gerente/i.test(m)) return 'Só o gerente pode fazer isso.';
  if (/same password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos e entre de novo.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem acesso. Use "Entrar".';
  if (/Password should/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/row-level security/i.test(m)) return 'Não permitido: o dia pode estar fechado ou você não tem permissão.';
  if (/duplicate key/i.test(m)) return 'Esse registro já existe.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com a internet.';
  return m;
}

/* ---------- Dados e cache offline ---------- */
async function pagina(q) {
  let all = [], from = 0;
  for (; ;) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  return all;
}
async function carregar() {
  try {
    const { data: safras, error } = await sb.from('cs_safras').select('*').eq('status', 'aberta').order('criado_em', { ascending: false }).limit(1);
    if (error) throw error;
    S.safra = safras[0] || null;
    if (S.safra) {
      S.talhoes = await pagina(() => sb.from('cs_talhoes').select('*').eq('safra_id', S.safra.id).order('nome'));
      S.cargas = await pagina(() => sb.from('cs_cargas').select('*').eq('safra_id', S.safra.id).order('data', { ascending: false }).order('hora', { ascending: false }).order('criado_em', { ascending: false }));
    }
    const { data: vs } = await sb.from('cs_variedades').select('*').order('nome'); if (vs) S.variedades = vs;
    if (S.safra) {
      const { data: pr } = await sb.from('cs_parametros').select('*').eq('safra_id', S.safra.id).maybeSingle(); if (pr) S.params = pr;
      const { data: ve } = await sb.from('cs_veiculos').select('*').order('placa'); if (ve) S.veiculos = ve;
      const { data: fe } = await sb.from('cs_fechamentos').select('data').eq('safra_id', S.safra.id); if (fe) S.fech = fe.map(x => x.data);
    }
    ls.set('cs_cache', { safra: S.safra, talhoes: S.talhoes, cargas: S.cargas, variedades: S.variedades, params: S.params, veiculos: S.veiculos, fech: S.fech });
    S.online = true;
  } catch (e) {
    const c = ls.get('cs_cache', null);
    if (c && !S.safra) { S.safra = c.safra; S.talhoes = c.talhoes; S.cargas = c.cargas; S.variedades = c.variedades || []; S.params = c.params || null; S.veiculos = c.veiculos || []; S.fech = c.fech || []; }
    if (/fetch|Network|Load failed/i.test(String(e.message))) S.online = false; else toast(traduz(e), true);
  }
}
async function carregarPerfil() {
  try {
    const { data, error } = await sb.from('cs_perfis').select('*').eq('id', S.user.id).maybeSingle();
    if (error) throw error;
    S.perfil = data; ls.set('cs_perfil', data);
  } catch { S.perfil = ls.get('cs_perfil', null); }
}

/* ---------- Fila offline ---------- */
const salvaFila = () => ls.set('cs_fila', S.fila);
async function enviarFila() {
  if (S.sync || !S.fila.length || !navigator.onLine) return;
  S.sync = true; let ok = 0;
  for (const r of [...S.fila]) {
    const { error } = await sb.from('cs_cargas').insert(r);
    if (!error || error.code === '23505') { S.fila = S.fila.filter(x => x.client_id !== r.client_id); ok++; }
    else if (/fetch|Network|Load failed/i.test(error.message)) break;
    else { toast('Carga viagem ' + r.viagem + ' recusada: ' + traduz(error), true); S.fila = S.fila.filter(x => x.client_id !== r.client_id); }
  }
  salvaFila(); S.sync = false;
  if (ok) { toast(ok + (ok > 1 ? ' viagens sincronizadas' : ' viagem sincronizada')); await carregar(); }
  render();
}
/* Desconto de umidade e impureza (parametrizável; padrão = fórmula Aprosoja MS, base 14%, impureza 1%) */
const PADRAO = { umidade_base: 14, impureza_tol: 1, modo: 'formula', perc_por_ponto: 1.5 };
function descontoKg(liq, umid, imp) {
  return { imp: 0, umid: 0, total: 0 }; /* desconto desativado: sacas = peso líquido ÷ 60 */
}
function descontoKgAntigo(liq, umid, imp) {
  const p = S.params || PADRAO; liq = Number(liq) || 0;
  if (p.modo === 'nenhum' || liq <= 0) return { imp: 0, umid: 0, total: 0 };
  const ub = Number(p.umidade_base), it = Number(p.impureza_tol);
  const pdi = imp != null && imp > it ? liq * (imp - it) / (100 - it) : 0;
  const base = liq - pdi;
  let pdu = 0;
  if (umid != null && umid > ub) pdu = p.modo === 'tabela' ? base * (umid - ub) * Number(p.perc_por_ponto) / 100 : base * (umid - ub) / (100 - ub);
  return { imp: pdi, umid: pdu, total: pdi + pdu };
}
const descCarga = c => descontoKg(c.liquido, c.umidade, c.impureza).total;
const sacasPagas = c => (Number(c.liquido) - descCarga(c)) / 60;
/* cargas do servidor + pendentes locais */
function todasCargas() {
  const ids = new Set(S.cargas.map(c => c.client_id).filter(Boolean));
  const pend = S.fila.filter(f => !ids.has(f.client_id)).map(f => ({
    ...f, id: 'p' + f.client_id, liquido: f.bruto - f.tara, sacas: (f.bruto - f.tara) / 60, status: 'ativa', _pend: true
  }));
  return [...pend, ...S.cargas];
}
const ativas = () => todasCargas().filter(c => c.status === 'ativa');

/* ---------- Ícones ---------- */
const I = {
  plus: '<path d="M12 5v14M5 12h14"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m5 7H3"/>', field: '<path d="M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4"/>',
  more: '<path d="M4 7h16M4 12h16M4 17h16"/>', table: '<path d="M4 5h16v14H4V5Zm0 5h16M4 14h16M10 5v14"/>'
};
I.baixar = '<path d="M12 4v11"/><path d="m7.5 11 4.500 4.500L16.500 11"/><path d="M5 19.500h14"/>';
I.zap = '<path d="M20.500 11.500a8.500 8.500 0 0 1-12.600 7.400L3.500 20.500l1.600-4.700A8.500 8.500 0 1 1 20.500 11.500Z"/><path d="M9.200 8.800c.3 2.600 2.800 5.100 5.800 5.800l1.200-1.300-2-1-.9.700c-.9-.4-1.700-1.200-2.100-2.100l.7-.9-1-2Z"/>';
I.imprimir = '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>';
const acao = (act, ic, titulo, sub, cls = '') => `<button class="btn-acao ${cls}" data-act="${act}"><span class="ic">${ico(ic)}</span><span class="tx"><b data-fit>${titulo}</b><small>${sub}</small></span></button>`;
const ico = k => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;

/* ---------- Render raiz ---------- */
/* números que cabem no quadro: reduz a fonte até não passar da borda */
function ajustaFontes() {
  document.querySelectorAll('[data-fit]').forEach(el => {
    el.style.fontSize = ''; let fs = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && fs > 12) { fs -= 1; el.style.fontSize = fs + 'px'; }
  });
}
/* números que "contam" até o valor ao abrir a aba (curto, respeita redução de movimento) */
function animaNumeros() {
  if (!S.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-count]').forEach(el => {
    const fim = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), t0 = performance.now(), fmt = v => dec ? n1(v) : n0(v);
    const passo = t => { const k = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(fim * e); if (k < 1) requestAnimationFrame(passo); else { el.textContent = fmt(fim); ajustaFontes(); } };
    requestAnimationFrame(passo);
  });
}
window.addEventListener('resize', () => ajustaFontes());
function anel(pct, titulo) {
  const r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct)), o = c * (1 - p);
  return `<svg viewBox="0 0 100 100" class="anel" role="img" aria-label="${esc(titulo)}"><circle class="trilho" cx="50" cy="50" r="${r}"/><circle class="prog ${S.anim ? 'anim' : ''}" cx="50" cy="50" r="${r}" style="--c:${c.toFixed(1)};--o:${o.toFixed(1)}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="54" text-anchor="middle">${pct > 0 ? Math.round(p * 100) + '%' : '—'}</text></svg>`;
}
/* barras arredondadas (valor de cada período) + linha do acumulado */
function graficoProducao(chaves, valores, rot) {
  const n = chaves.length, W = 420, H = 210, L = 6, R = 44, T = 24, B = 26, iw = W - L - R, ih = H - T - B;
  const maxV = Math.max(1, ...valores), acum = []; valores.reduce((a, v, i) => (acum[i] = a + v), 0);
  const maxA = Math.max(1, acum[n - 1] || 1), slot = iw / n, bw = Math.min(34, slot * 0.58);
  const X = i => L + slot * i + slot / 2, Yb = v => T + ih - (v / maxV) * ih, Ya = v => T + ih - (v / maxA) * ih;
  const bars = valores.map((v, i) => { const h = Math.max(3, T + ih - Yb(v)); return `<rect class="b" style="--i:${i}" x="${(X(i) - bw / 2).toFixed(1)}" y="${(T + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(9, bw / 2).toFixed(1)}"/>${n <= 9 ? `<text class="v" x="${X(i).toFixed(1)}" y="${(T + ih - h - 6).toFixed(1)}" text-anchor="middle">${n0(v)}</text>` : ''}`; }).join('');
  const pts = acum.map((v, i) => `${X(i).toFixed(1)},${Ya(v).toFixed(1)}`);
  const linha = n > 1 ? `<path class="acum" pathLength="1" d="M${pts.join(' L')}"/>` : '';
  const area = n > 1 ? `<path class="area" d="M${X(0).toFixed(1)},${T + ih} L${pts.join(' L')} L${X(n - 1).toFixed(1)},${T + ih} Z"/>` : '';
  const fim = `<circle class="pt" cx="${X(n - 1).toFixed(1)}" cy="${Ya(acum[n - 1]).toFixed(1)}" r="5"/><text class="ac" x="${(W - 4).toFixed(1)}" y="${(Ya(acum[n - 1]) + 4).toFixed(1)}" text-anchor="end">${n0(acum[n - 1])}</text>`;
  const eixo = chaves.map((k, i) => (n <= 10 || i % 2 === 0) ? `<text class="x" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(k)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="gprod ${S.anim ? 'anim' : ''}" role="img" aria-label="${esc(rot)}"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s1"/><stop offset="1" class="s2"/></linearGradient><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="a1"/><stop offset="1" class="a2"/></linearGradient></defs><line class="base" x1="${L}" y1="${T + ih}" x2="${W - R + 8}" y2="${T + ih}"/>${area}${bars}${linha}${fim}${eixo}</svg>`;
}
function render() {
  const app = $('#app');
  if (!S.user) return app.innerHTML = telaLogin();
  if (!S.perfil) return app.innerHTML = telaSemAcesso();
  S.anim = !!S.animar; S.animar = false;
  const tabs = [['lancar', 'Viagem', 'plus'], ['cargas', 'Viagens', 'list'], ['resumo', 'Resumo', 'table'], ['painel', 'Painel', 'chart'], ['talhoes', 'Talhões', 'field'], ['mais', 'Mais', 'more']];
  const nf = S.fila.length;
  const nav = tabs.map(([k, l, i]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${ico(i)}<span>${l}</span>${k === 'mais' && nf ? `<i class="dot">${nf}</i>` : ''}</button>`).join('');
  const net = `<span class="net ${S.online ? '' : 'off'}">${S.online ? (nf ? nf + ' a enviar' : 'Conectado') : 'Sem internet' + (nf ? ' · ' + nf + ' salvas' : '')}</span>`;
  const f = { lancar: viewLancar, cargas: viewCargas, resumo: viewResumo, painel: viewPainel, talhoes: viewTalhoes, mais: viewMais }[S.tab];
  const scrollY = window.scrollY;
  const keep = S.tab === 'lancar' && !S.limpar ? snapshotForm() : null; S.limpar = false;
  app.innerHTML = `<div class="shell">
    <header class="top"><div><b>Controle de Safra</b><small>Fazenda Lagoa Formosa${S.safra ? ' · ' + esc(S.safra.nome) : ''}</small></div>${net}</header>
    <aside class="side"><div class="brand"><b>Controle de Safra</b><small>Fazenda Lagoa Formosa${S.safra ? '<br>Safra ' + esc(S.safra.nome) : ''}</small></div><nav class="tabbar" id="tabbar">${nav}</nav></aside>
    <div class="body"><main class="${S.anim ? 'enter' : ''}">${!S.safra ? '<div class="card empty">Nenhuma safra aberta. Peça ao gerente para abrir a safra.</div>' : f()}</main></div></div>`;
  if (keep) restoreForm(keep);
  window.scrollTo(0, scrollY);
  if (S.tab === 'lancar') bindLancar();
  ajustaFontes(); animaNumeros();
}

/* ---------- Login ---------- */
function telaLogin() {
  const em = ls.get('cs_email', '');
  return `<div class="login"><img class="logo" src="icons/icon-192.png" alt="">
  <h1>Controle de Safra</h1><p>Fazenda Lagoa Formosa</p>
  ${S.erroLogin ? `<div class="msg">${esc(S.erroLogin)}</div>` : ''}
  <form id="fLogin"><div class="field"><label>E-mail</label><input id="lEmail" type="email" autocomplete="username" inputmode="email" autocapitalize="off" required value="${esc(em)}"></div>
  <div class="field"><label>Senha</label><div class="pw"><input id="lSenha" type="password" autocomplete="current-password" required minlength="6"><button type="button" class="eye" data-act="verSenha" aria-label="Mostrar senha">Ver</button></div></div>
  <button class="btn" type="submit" id="lBtn" ${S.entrando ? 'disabled' : ''}>${S.entrando ? 'Entrando…' : 'Entrar'}</button></form>
  <p class="hint" style="text-align:center;margin-top:16px">Sem acesso ainda? Peça ao gerente para criar o seu.</p></div>`;
}
function telaSemAcesso() {
  return `<div class="login"><img class="logo" src="icons/icon-192.png" alt=""><h1>Acesso não liberado</h1>
  <p>${esc(S.user.email)} ainda não tem permissão neste sistema. Fale com o gerente.</p>
  <button class="btn sec" id="lSair">Sair</button></div>`;
}

/* ---------- Lançar viagem ---------- */
const TIPOS = [['intacta', 'Intacta'], ['rr', 'RR'], ['convencional', 'Convencional']];
function snapshotForm() { const f = $('#fCarga'); if (!f) return null; return Object.fromEntries([...f.elements].filter(e => e.id && e.type !== 'file' && !['cTipo', 'cVar'].includes(e.id) && (e.id !== 'cViagem' || S.viagemEditada)).map(e => [e.id, e.value])); }
function restoreForm(v) { for (const [k, val] of Object.entries(v)) { const e = document.getElementById(k); if (e) e.value = val; } }
const veiculoDe = placa => S.veiculos.find(v => v.placa === placa) || null;
const ultimoPorPlaca = placa => { const v = veiculoDe(placa); if (v && v.tara_padrao) return v.tara_padrao; const c = todasCargas().find(x => x.placa === placa); return c ? c.tara : null; };
/* próxima viagem = maior número das viagens ATIVAS + 1 (um número cancelado no fim da fila é reaproveitado); 'Reutilizar número' força um número cancelado do meio */
function proxViagem() { return S.viagemForcada || ativas().reduce((m, c) => Math.max(m, c.viagem || 0), 0) + 1; }
const varOpts = tipo => S.variedades.filter(v => v.ativo && v.tipo === tipo).map(v => `<option value="${v.id}" ${S.lt.vari === v.id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('');
function alertasViagem(d) {
  const a = [], liq = d.bruto - d.tara;
  if (liq > 80000) a.push('Peso líquido acima de 80.000 kg.');
  if (liq > 0 && liq < 5000) a.push(`Peso líquido muito baixo (${n0(liq)} kg). Confira o peso bruto e a tara.`);
  const mesmas = ativas().filter(c => c.placa === d.placa);
  if (mesmas.length >= 3) {
    const m = mesmas.reduce((s, c) => s + Number(c.liquido), 0) / mesmas.length;
    if (liq > 0 && Math.abs(liq - m) / m > 0.25) a.push(`Peso líquido (${n0(liq)} kg) muito diferente da média desta placa (${n0(m)} kg).`);
  }
  const t0 = ultimoPorPlaca(d.placa);
  if (t0 && d.tara && Math.abs(d.tara - t0) > 300) a.push(`Tara (${n0(d.tara)} kg) difere da última desta placa (${n0(t0)} kg).`);
  if (ativas().some(c => c.viagem === d.viagem && c.placa === d.placa && c.data === hoje())) a.push(`Já existe a viagem ${d.viagem} desta placa hoje.`);
  if (d.umid != null && d.umid > 18) a.push(`Umidade alta (${n1(d.umid)}%).`);
  if (d.umid != null && d.umid < 8) a.push(`Umidade muito baixa (${n1(d.umid)}%). Confira.`);
  return a;
}
function viewLancar() {
  const placas = [...new Set([...S.veiculos.map(v => v.placa), ...todasCargas().map(c => c.placa)])].sort();
  const tal = S.talhoes.filter(t => t.ativo);
  if (!tal.length) return `<div class="card empty">Nenhum talhão cadastrado nesta safra ainda.<br>O gerente precisa cadastrar os talhões primeiro.</div>`;
  const tipo = S.lt.tipo || 'intacta';
  return `<div class="pagehead"><h1>Lançar viagem</h1><span>${brData(hoje())} · ${agoraHora()}</span></div>
  <form id="fCarga" class="card" autocomplete="off">
    <div class="viagem"><label>Viagem nº</label><input id="cViagem" inputmode="numeric" pattern="[0-9]*" value="${proxViagem()}" required></div>
    <div class="field"><label>Talhão</label><select id="cTal" required><option value="">Selecione o talhão…</option>${tal.map(t => `<option value="${t.id}" ${S.lt.tal === t.id ? 'selected' : ''}>${esc(t.nome)}${variedadeDe(t) ? ' · ' + esc(variedadeDe(t).nome) : ''}</option>`).join('')}</select></div>
    <div class="field"><label>Tipo de soja</label><div class="tipos" id="cTipos">${TIPOS.map(([k, n]) => `<button type="button" data-tipo="${k}" class="${tipo === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>Variedade</label><select id="cVar" required><option value="">Selecione a variedade…</option>${varOpts(tipo)}</select></div>
    <div class="row2"><div class="field"><label>Placa / equipamento</label><input id="cPlaca" class="up" list="dlPlacas" required maxlength="16" autocapitalize="characters"><datalist id="dlPlacas">${placas.map(p => `<option value="${esc(p)}">`).join('')}</datalist><div class="hint" id="hVei"></div></div>
    <div class="field"><label>Tara (kg)</label><input id="cTara" inputmode="numeric" placeholder="ex.: 14.000" required><div class="hint" id="hTara"></div></div></div>
    <div class="field"><label>Foto da balança (peso bruto)</label>
      <label class="btn sec" for="cFoto" style="cursor:pointer">${S.fotoUrl ? 'Trocar a foto' : 'Escolher foto da balança'}</label>
      <input id="cFoto" type="file" accept="image/*" hidden>
      <div id="fotoBox">${S.fotoUrl ? `<img class="fotoprev" src="${S.fotoUrl}" alt="foto da balança">` : '<div class="hint">Escolha a foto da balança que está na galeria ou nos arquivos. O app lê o peso sozinho. Se preferir, digite o peso abaixo.</div>'}</div></div>
    <div class="row2"><div class="field"><label>Peso bruto (kg)</label><input id="cBruto" inputmode="numeric" placeholder="ex.: 40.940" required></div>
    <div class="field"><label>Umidade %</label><input id="cUmid" inputmode="decimal" placeholder="ex.: 13,5"></div></div>
    <div class="preview" id="prev"></div>
    <div id="cAlertas"></div>
    <button class="btn" type="submit">Salvar viagem</button>
  </form>
  <div class="card"><h2>Últimas viagens</h2><div class="list">${todasCargas().slice(0, 5).map(itemCarga).join('') || '<div class="empty">Nenhuma viagem lançada ainda.</div>'}</div></div>`;
}
function bindLancar() {
  const g = id => document.getElementById(id); if (!g('fCarga')) return;
  const num = id => parseInt(String(g(id).value).replace(/\D/g, ''), 10) || 0;
  const dec = id => { const u = String(g(id).value).replace(',', '.').trim(); return u === '' ? null : parseFloat(u); };
  const dados = () => ({ placa: normPlaca(g('cPlaca').value), tara: num('cTara'), bruto: num('cBruto'), viagem: num('cViagem'), umid: dec('cUmid'), imp: null });
  const calc = () => {
    const d = dados(), l = d.bruto - d.tara, bad = d.bruto && d.tara && l <= 0, liq = Math.max(l, 0);
    g('prev').innerHTML = `<div class="${bad ? 'bad' : ''}"><span>${bad ? 'Bruto menor que a tara!' : 'Peso líquido'}</span><b>${n0(liq)} <small>kg</small></b></div>
      <div class="${bad ? 'bad' : ''}"><span>Sacas</span><b>${n1(liq / 60)} <small>sc</small></b></div>`;
    const al = d.bruto > d.tara ? alertasViagem(d) : [];
    g('cAlertas').innerHTML = al.length ? `<div class="alerta">${al.map(x => '⚠ ' + esc(x)).join('<br>')}</div>` : '';
  };
  const pinta = () => {
    const tipo = S.lt.tipo || 'intacta';
    g('cTipos').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tipo === tipo));
    const cur = S.lt.vari; g('cVar').innerHTML = '<option value="">Selecione a variedade…</option>' + varOpts(tipo);
    if (cur && S.variedades.some(v => v.id === cur && v.tipo === tipo)) g('cVar').value = cur; else { g('cVar').value = ''; S.lt.vari = null; }
  };
  g('cTipos').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (!b) return; S.lt.tipo = b.dataset.tipo; S.lt.vari = null; pinta(); });
  g('cVar').addEventListener('change', e => { S.lt.vari = e.target.value || null; });
  g('cTal').addEventListener('change', e => {
    S.lt.tal = e.target.value || null;
    const t = S.talhoes.find(x => x.id === S.lt.tal), v = t && variedadeDe(t);
    if (v) { S.lt.tipo = v.tipo; S.lt.vari = v.id; pinta(); }
  });
  g('cPlaca').addEventListener('input', e => {
    const np = normPlaca(e.target.value); e.target.value = fmtPlaca(np);
    const t = ultimoPorPlaca(np), v = veiculoDe(np);
    g('hVei').textContent = v && (v.transportadora || v.motorista) ? [v.transportadora, v.motorista].filter(Boolean).join(' · ') : '';
    if (t) { g('hTara').textContent = (v && v.tara_padrao ? 'Tara padrão: ' : 'Última tara: ') + n0(t) + ' kg (toque para usar)'; g('hTara').dataset.t = t; } else { g('hTara').textContent = ''; delete g('hTara').dataset.t; }
    calc();
  });
  g('cFoto').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const box = g('fotoBox'), msg = t => { const m = g('fotoMsg'); if (m) m.innerHTML = t; };
    try { S.foto = await comprimeFoto(f); } catch { S.foto = f; }
    if (S.fotoUrl) URL.revokeObjectURL(S.fotoUrl); S.fotoUrl = URL.createObjectURL(S.foto);
    box.innerHTML = `<img class="fotoprev" src="${S.fotoUrl}" alt="foto da balança"><div class="hint" id="fotoMsg">Lendo o peso da foto…</div>`;
    try {
      const r = await lerPesoFoto(f);
      if (!r.valor) return msg('Não consegui ler o número. Digite o peso bruto.');
      g('cBruto').value = maskMilhar(r.valor); g('cBruto').classList.add('conferir'); calc();
      msg(`Peso lido: <b>${n0(r.valor)} kg</b>. Confira com a foto antes de salvar.` + (r.candidatos.length > 1 ? `<div class="cands">Outros números na foto: ${r.candidatos.slice(1).map(n => `<button type="button" data-peso="${n}">${n0(n)}</button>`).join('')}</div>` : ''));
    } catch { msg('Sem internet para ler a foto agora. Digite o peso bruto; a foto fica guardada.'); }
  });
  g('fotoBox').addEventListener('click', e => { const b = e.target.closest('[data-peso]'); if (b) { g('cBruto').value = maskMilhar(b.dataset.peso); g('cBruto').classList.remove('conferir'); calc(); } });
  g('cBruto').addEventListener('input', e => e.target.classList.remove('conferir'));
  g('hTara').addEventListener('click', () => { if (g('hTara').dataset.t) { g('cTara').value = maskMilhar(g('hTara').dataset.t); calc(); g('cBruto').focus(); } });
  ['cTara', 'cBruto'].forEach(id => g(id).addEventListener('input', e => { e.target.value = maskMilhar(e.target.value); }));
  g('cViagem').addEventListener('input', () => { S.viagemEditada = true; });
  g('cUmid').addEventListener('input', e => { e.target.value = maskDec(e.target.value); });
  ['cTara', 'cBruto', 'cUmid', 'cViagem'].forEach(id => g(id).addEventListener('input', calc));
  g('fCarga').addEventListener('submit', async ev => {
    ev.preventDefault();
    const d = dados();
    if (!g('cTal').value) return toast('Escolha o talhão.', true);
    if (!g('cVar').value) return toast('Escolha a variedade.', true);
    if (d.placa.length < 3) return toast('Informe a placa.', true);
    if (!d.viagem) return toast('Informe o nº da viagem.', true);
    if (!d.tara || !d.bruto) return toast('Informe tara e peso bruto.', true);
    if (d.bruto <= d.tara) return toast('O peso bruto precisa ser maior que a tara.', true);
    if (d.umid !== null && !(d.umid >= 0 && d.umid <= 60)) return toast('Umidade inválida.', true);
    const al = alertasViagem(d);
    if (al.length && !confirm(al.join('\n') + '\n\nSalvar mesmo assim?')) return;
    const r = { client_id: uuid(), safra_id: S.safra.id, talhao_id: g('cTal').value, variedade_id: g('cVar').value, data: hoje(), hora: agoraHora(), viagem: d.viagem, placa: d.placa, tara: d.tara, bruto: d.bruto, umidade: d.umid };
    if (S.foto) { fotoSalva(r.client_id, S.foto); URL.revokeObjectURL(S.fotoUrl); S.foto = null; S.fotoUrl = null; }
    S.viagemForcada = null; S.viagemEditada = false;
    S.fila.push(r); salvaFila(); S.lt = { tal: r.talhao_id, tipo: S.lt.tipo, vari: r.variedade_id }; ls.set('cs_ult', S.lt);
    toast('Viagem ' + d.viagem + ' salva — ' + n1((d.bruto - d.tara) / 60) + ' sacas');
    S.tab = 'lancar'; S.limpar = true; render();
    g('cPlaca') && document.getElementById('cPlaca').focus();
    enviarFila();
  });
  calc();
}

/* ---------- Lista de cargas ---------- */
const variedadeDe = t => S.variedades.find(v => v.id === t.variedade_id) || null;
const nomeVar = c => { const v = S.variedades.find(x => x.id === c.variedade_id); return v ? v.nome : ''; };
const nomeTal = id => (S.talhoes.find(t => t.id === id) || {}).nome || '—';
function itemCarga(c) {
  return `<button class="item ${c.status === 'cancelada' ? 'canc' : ''}" data-carga="${c.id}"><div class="n">${c.viagem ?? '·'}</div>
  <div class="m"><b>${esc(fmtPlaca(c.placa))}${c._pend ? '<i class="badge">a enviar</i>' : ''}</b><small>${esc(nomeTal(c.talhao_id))}${nomeVar(c) ? ' · ' + esc(nomeVar(c)) : ''} · ${brData(c.data)} ${(c.hora || '').slice(0, 5)}</small></div>
  <div class="v">${n1(sacasPagas(c))} sc<small>${n0(c.liquido)} kg</small></div></button>`;
}
const diaFechado = d => S.fech.includes(d);
function viewCargas() {
  const lista = todasCargas().filter(c => c.data === S.dia);
  const at = lista.filter(c => c.status === 'ativa'), ger = S.perfil.papel === 'gerente', fechado = diaFechado(S.dia);
  return `<div class="pagehead"><h1>Viagens</h1><span>${at.length} viagens · ${n1(soma(at, 'sacas'))} sc</span></div>
  <div class="card"><div class="field" style="margin:0"><label>Dia ${fechado ? '<i class="badge">fechado</i>' : ''}</label><input type="date" id="dDia" value="${S.dia}"></div>
  ${ger && !fechado && at.length ? '<button class="btn yel" style="margin-top:12px" data-act="fecharDia">Fechar o dia e enviar resumo</button>' : ''}
  ${fechado ? `<div class="acoes um">${acao('zapDia', 'zap', 'Reenviar resumo do dia', 'pelo WhatsApp', 'wa')}</div>` : ''}
  ${fechado && ger ? '<button class="btn red" style="margin-top:10px" data-act="reabrirDia">Reabrir o dia</button>' : ''}</div>
  <div class="card list">${lista.map(itemCarga).join('') || '<div class="empty">Nenhuma viagem neste dia.</div>'}</div>`;
}
function resumoDia(dia) {
  const d = ativas().filter(c => c.data === dia), por = {}, pv = {};
  d.forEach(c => { const t = nomeTal(c.talhao_id), v = nomeVar(c) || 'Sem variedade'; (por[t] ||= { nome: t, n: 0, sc: 0 }).n++; por[t].sc += Number(c.sacas); (pv[v] ||= { nome: v, n: 0, sc: 0 }).n++; pv[v].sc += Number(c.sacas); });
  return { dia, viagens: d.length, kg: soma(d, 'liquido'), sacas: soma(d, 'sacas'), descontos_kg: d.reduce((a, c) => a + descCarga(c), 0), por_talhao: Object.values(por), por_variedade: Object.values(pv) };
}
function textoDia(r) {
  return `*Colheita ${S.safra.nome} — Lagoa Formosa*\nFechamento de ${brData(r.dia)}\n\n${r.viagens} viagens · ${n0(r.sacas)} sacas (${n1(r.kg / 1000)} t)\n\n*Por talhão*\n${r.por_talhao.map(x => `• ${x.nome}: ${x.n} viag. · ${n0(x.sc)} sc`).join('\n')}\n\n*Por variedade*\n${r.por_variedade.map(x => `• ${x.nome}: ${n0(x.sc)} sc`).join('\n')}\n\nAcumulado da safra: ${n0(soma(ativas(), 'sacas'))} sacas${soma(S.talhoes, 'area_colhida_ha') ? '\nMédia geral: ' + n1(soma(ativas(), 'sacas') / soma(S.talhoes, 'area_colhida_ha')) + ' sc/ha' : ''}`;
}
function textoViagem(c) {
  const u = c.umidade != null ? n1(c.umidade) + '%' : '—';
  return `*Viagem ${c.viagem ?? ''} — Lagoa Formosa*\nSafra ${S.safra ? S.safra.nome : ''} · ${brData(c.data)} ${(c.hora || '').slice(0, 5)}\n\nTalhão: ${nomeTal(c.talhao_id)}\nVariedade: ${nomeVar(c) || '—'}\nPlaca: ${fmtPlaca(c.placa)}\n\nPeso líquido: ${n0(c.liquido)} kg\n*Sacas: ${n1(c.sacas)}*\nUmidade: ${u}`;
}
async function compartilhaViagem(id) {
  const c = todasCargas().find(x => String(x.id) === id); if (!c) return;
  const txt = textoViagem(c), b = await fotoLe(c.client_id);
  if (b && navigator.canShare) {
    const f = new File([b], `viagem-${c.viagem ?? ''}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: txt }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  if (b) toast('Este aparelho não envia a foto direto. Enviei só o texto.', true);
}
function abrirCarga(id) {
  const c = todasCargas().find(x => String(x.id) === id); if (!c) return;
  setTimeout(() => fotoLe(c.client_id).then(b => { const v = document.getElementById('vFoto'); if (b && v) v.innerHTML = `<img class="fotoprev" src="${URL.createObjectURL(b)}" alt="foto da balança" style="margin:0 0 12px">`; }), 0);
  const fechadoDia = diaFechado(c.data), pode = !fechadoDia && (S.perfil.papel === 'gerente' || (c.data >= diasAtras(1)));
  sheet(`<div class="vhero"><div class="vn"><small>Viagem</small>${c.viagem ?? '·'}</div>
    <div class="vt">${esc(nomeTal(c.talhao_id))}${nomeVar(c) ? ' · ' + esc(nomeVar(c)) : ''}</div>
    <div class="vp">${n0(c.liquido)} <small>kg líquidos</small></div>
    <div class="vs">${esc(fmtPlaca(c.placa))} · ${n1(c.sacas)} sc</div></div>
  <div id="vFoto"></div>
  <button class="btn zap" data-act="zapCarga" data-id="${c.id}">Enviar no WhatsApp</button>
  <div class="kv" style="margin-top:12px"><span>Data e hora</span><b>${brData(c.data)} ${(c.hora || '').slice(0, 5)}</b></div>
  <div class="kv"><span>Tara</span><b>${n0(c.tara)} kg</b></div><div class="kv"><span>Peso bruto</span><b>${n0(c.bruto)} kg</b></div>
  <div class="kv"><span>Peso líquido</span><b>${n0(c.liquido)} kg</b></div><div class="kv"><span>Sacas</span><b>${n1(c.sacas)}</b></div>
  <div class="kv"><span>Umidade</span><b>${c.umidade != null ? n1(c.umidade) + '%' : '—'}</b></div>
  ${c.status === 'cancelada' ? `<div class="msg" style="margin-top:12px">Cancelada: ${esc(c.motivo_cancelamento)}</div>${c.viagem && !ativas().some(x => x.viagem === c.viagem) ? `<button class="btn yel" style="margin-bottom:10px" data-act="reusarNumero" data-n="${c.viagem}">Reutilizar número ${c.viagem}</button>` : ''}` : ''}
  ${fechadoDia && c.status === 'ativa' ? '<div class="msg" style="margin-top:12px">Este dia está fechado: a viagem não pode ser cancelada. O gerente pode reabrir o dia na aba Viagens.</div>' : ''}
  ${c._pend ? '<div class="hint" style="margin:10px 0">Salva no aparelho, aguardando internet para enviar.</div>' : ''}
  ${c.status === 'ativa' && pode ? (c._pend ? `<button class="btn red" style="margin-top:14px" data-act="descartar" data-id="${c.client_id}">Descartar carga</button>` : `<div class="field" style="margin-top:14px"><label>Motivo do cancelamento</label><input id="cMotivo" placeholder="ex.: pesagem digitada errado"></div><button class="btn red" data-act="cancelar" data-id="${c.id}">Cancelar carga</button>`) : ''}
  <button class="btn sec" style="margin-top:10px" data-act="fechar">Fechar</button>`);
}

/* ---------- Dashboard ---------- */
function filtrar() {
  let l = ativas();
  if (S.periodo === 'hoje') l = l.filter(c => c.data === hoje());
  else if (S.periodo === '7d') l = l.filter(c => c.data >= diasAtras(6));
  if (S.fTalhao) l = l.filter(c => c.talhao_id === S.fTalhao);
  return l;
}
const soma = (l, k) => l.reduce((a, c) => a + Number(c[k] || 0), 0);
function viewPainel() {
  const l = filtrar(), sacas = soma(l, 'sacas'), kg = soma(l, 'liquido');
  const comU = l.filter(c => c.umidade != null), umid = comU.length ? soma(comU, 'umidade') / comU.length : null;
  const tF = S.fTalhao ? S.talhoes.find(t => t.id === S.fTalhao) : null;
  const areaTot = tF ? Number(tF.area_ha || 0) : soma(S.talhoes.filter(t => t.ativo), 'area_ha');
  const haColh = tF ? Number(tF.area_colhida_ha || 0) : soma(S.talhoes, 'area_colhida_ha'), haRest = Math.max(areaTot - haColh, 0);
  const baseSc = soma(tF ? ativas().filter(c => c.talhao_id === tF.id) : ativas(), 'sacas'), mediaGeral = haColh ? baseSc / haColh : 0;
  /* produção: por hora (hoje) ou por dia */
  const grp = {}; l.forEach(c => { const k = S.periodo === 'hoje' ? String(c.hora || '00').slice(0, 2) : c.data; grp[k] = (grp[k] || 0) + Number(c.sacas); });
  const ks = Object.keys(grp).sort().slice(S.periodo === 'hoje' ? -24 : -14);
  const rot = k => S.periodo === 'hoje' ? k + 'h' : k.slice(8) + '/' + k.slice(5, 7);
  /* talhões */
  const porTal = S.talhoes.map(t => { const sc = soma(l.filter(x => x.talhao_id === t.id), 'sacas'), tot = soma(ativas().filter(x => x.talhao_id === t.id), 'sacas'), hc = Number(t.area_colhida_ha || 0); return { t, sc, pr: hc ? tot / hc : 0 }; }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc);
  const maxSc = Math.max(1, ...porTal.map(x => x.sc));
  const linhaTal = x => `<div class="bar"><div class="lb">${esc(x.t.nome)}</div><div class="tr"><i class="${S.anim ? 'anim' : ''}" style="width:${x.sc / maxSc * 100}%"></i></div><div class="vl"><b>${n0(x.sc)}</b> sc${x.pr ? ' · ' + n1(x.pr) + '/ha' : ''}</div></div>`;
  /* detalhes */
  const vei = {}; l.forEach(c => { const v = vei[c.placa] ||= { n: 0, sc: 0 }; v.n++; v.sc += Number(c.sacas); });
  const veic = Object.entries(vei).sort((a, b) => b[1].sc - a[1].sc);
  const faixas = [['até 13%', 0, 13], ['13–15%', 13, 15], ['15–18%', 15, 18], ['acima de 18%', 18, 99]];
  const fu = faixas.map(([n, a, b]) => [n, comU.filter(c => c.umidade > a - (a === 0 ? 1 : 0) && c.umidade <= b).length]);
  const vr = {}; l.forEach(c => { const t = S.talhoes.find(x => x.id === c.talhao_id); const k = (t && variedadeDe(t) && variedadeDe(t).nome) || nomeVar(c) || 'Sem variedade'; vr[k] = (vr[k] || 0) + Number(c.sacas); });
  const varied = Object.entries(vr).sort((a, b) => b[1] - a[1]), maxV = Math.max(1, ...varied.map(x => x[1]));
  const per = [['hoje', 'Hoje'], ['7d', '7 dias'], ['safra', 'Safra toda']].map(([k, n]) => `<button data-per="${k}" class="${S.periodo === k ? 'on' : ''}">${n}</button>`).join('');
  return `<div class="pagehead"><h1>Painel</h1><span>Safra ${esc(S.safra.nome)}</span></div>
  <div class="chips">${per}</div>
  <div class="field"><select id="fTal" aria-label="Talhão"><option value="">Todos os talhões</option>${S.talhoes.map(t => `<option value="${t.id}" ${S.fTalhao === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
  <div class="hero2 rise"><div class="hl"><span>Sacas colhidas</span><b data-fit data-count="${sacas}">${n0(sacas)}</b><em>sc</em>
    <div class="hsub">${n0(l.length)} viagens · ${n1(kg / 1000)} t${umid == null ? '' : ' · umid. ' + n1(umid) + '%'}</div></div>
    <div class="hr">${anel(areaTot ? haColh / areaTot : 0, 'Hectares colhidos')}<small>ha colhidos</small></div></div>
  <div class="tiles rise"><div class="tile"><span>Média geral</span><b data-fit>${haColh ? n1(mediaGeral) : '—'}</b><em>sc/ha</em></div>
    <div class="tile"><span>Colhidos</span><b data-fit>${n1(haColh)}</b><em>ha</em></div>
    <div class="tile"><span>Restantes</span><b data-fit>${n1(haRest)}</b><em>ha</em></div></div>
  ${haColh ? '' : '<div class="alerta">Informe os hectares colhidos de cada talhão (aba Talhões) para ver as médias por hectare.</div>'}
  <div class="card chart rise"><h2>${S.periodo === 'hoje' ? 'Produção por hora' : 'Produção por dia'}<small>barras = sacas no período · linha = acumulado</small></h2>${ks.length ? graficoProducao(ks.map(rot), ks.map(k => grp[k]), 'Produção') : '<div class="empty">Sem viagens no período.</div>'}</div>
  <div class="card rise"><h2>Sacas por talhão</h2>${porTal.slice(0, 8).map(linhaTal).join('') || '<div class="empty">Sem dados no período.</div>'}${porTal.length > 8 ? `<details class="mais"><summary>Ver todos (${porTal.length})</summary>${porTal.slice(8).map(linhaTal).join('')}</details>` : ''}</div>
  <details class="mais card"><summary>Mais detalhes</summary>
    <h3>Por variedade</h3>${varied.map(([k, v]) => `<div class="bar"><div class="lb">${esc(k)}</div><div class="tr"><i style="width:${v / maxV * 100}%"></i></div><div class="vl">${n0(v)} sc</div></div>`).join('') || '<div class="empty">—</div>'}
    <h3>Umidade das viagens</h3>${comU.length ? fu.map(([k, v]) => `<div class="bar"><div class="lb">${k}</div><div class="tr"><i style="width:${v / Math.max(1, comU.length) * 100}%"></i></div><div class="vl">${v}</div></div>`).join('') : '<div class="empty">Nenhuma umidade informada.</div>'}
    <h3>Por veículo</h3>${veic.length ? `<div class="tscroll"><table class="rs"><tr><th>Placa</th><th>Viagens</th><th>Sacas</th><th>Média</th></tr>${veic.map(([p, v]) => `<tr><td>${esc(fmtPlaca(p))}</td><td>${v.n}</td><td>${n0(v.sc)}</td><td>${n1(v.sc / v.n)} sc</td></tr>`).join('')}</table></div>` : '<div class="empty">Sem dados.</div>'}</details>
  <div class="acoes noprint">${acao('csv', 'baixar', 'Baixar planilha', 'arquivo CSV')}${acao('zap', 'zap', 'Enviar resumo', 'pelo WhatsApp', 'wa')}</div>`;
}
function exportarCSV() {
  const cab = ['Data', 'Hora', 'Viagem', 'Placa', 'Talhão', 'Tara kg', 'Bruto kg', 'Líquido kg', 'Sacas', 'Umidade %', 'Status'];
  const lin = todasCargas().slice().reverse().map(c => [brData(c.data), (c.hora || '').slice(0, 5), c.viagem, c.placa, nomeTal(c.talhao_id), c.tara, c.bruto, c.liquido, String(Number(c.sacas).toFixed(2)).replace('.', ','), c.umidade ?? '', c.status]);
  const csv = '﻿' + [cab, ...lin].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `cargas-safra-${S.safra.nome.replace('/', '-')}-${hoje()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function resumoZap() {
  const d = ativas().filter(c => c.data === hoje()), tot = ativas();
  const porT = {}; d.forEach(c => { porT[nomeTal(c.talhao_id)] = (porT[nomeTal(c.talhao_id)] || 0) + Number(c.sacas); });
  const txt = `*Colheita ${S.safra.nome} — Lagoa Formosa*\n${brData(hoje())}\n\nHoje: ${d.length} cargas · ${n0(soma(d, 'sacas'))} sacas (${n1(soma(d, 'liquido') / 1000)} t)\n${Object.entries(porT).map(([k, v]) => `• ${k}: ${n0(v)} sc`).join('\n')}\n\nAcumulado da safra: ${n0(soma(tot, 'sacas'))} sacas em ${tot.length} cargas`;
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

/* ---------- Resumo (modelo da planilha RESUMO GERAL) ---------- */
function dadosResumo() {
  const l = ativas();
  const talhoes = S.talhoes.map(t => {
    const c = l.filter(x => x.talhao_id === t.id), ha = Number(t.area_colhida_ha || 0), sc = soma(c, 'sacas');
    const comU = c.filter(x => x.umidade != null);
    const vars = [...new Set(c.map(nomeVar).filter(Boolean))];
    return { t, ha, n: c.length, kg: soma(c, 'liquido'), sc, scHa: ha && sc ? sc / ha : 0, dias: new Set(c.map(x => x.data)).size, umid: comU.length ? soma(comU, 'umidade') / comU.length : null, vars };
  });
  const tipos = TIPOS.map(([k, nome]) => {
    const c = l.filter(x => { const v = S.variedades.find(y => y.id === x.variedade_id); return v && v.tipo === k; });
    const ids = new Set(c.map(x => x.talhao_id));
    const ha = S.talhoes.filter(t => ids.has(t.id)).reduce((a, t) => a + Number(t.area_colhida_ha || 0), 0), sc = soma(c, 'sacas');
    return { k, nome, n: c.length, sc, ha, scHa: ha && sc ? sc / ha : 0 };
  });
  const porVar = {}; l.forEach(c => { const v = S.variedades.find(y => y.id === c.variedade_id); const k = v ? v.nome : 'Sem variedade'; const o = porVar[k] ||= { nome: k, tipo: v ? v.tipo : '', n: 0, sc: 0 }; o.n++; o.sc += Number(c.sacas); });
  return { l, talhoes, tipos, variedades: Object.values(porVar).sort((a, b) => b.sc - a.sc) };
}
function viewResumo() {
  const R = dadosResumo(), l = R.l;
  const mTal = R.talhoes.filter(x => x.scHa > 0), mediaTal = mTal.length ? mTal.reduce((a, x) => a + x.scHa, 0) / mTal.length : 0;
  const haTot = soma(S.talhoes.filter(t => t.ativo), 'area_ha'), scTot = soma(l, 'sacas'), kgTot = soma(l, 'liquido');
  const desc = l.reduce((a, c) => a + descCarga(c), 0), haColh = soma(S.talhoes, 'area_colhida_ha'), haRest = Math.max(haTot - haColh, 0);
  const comU = l.filter(c => c.umidade != null), umidMed = comU.length ? soma(comU, 'umidade') / comU.length : null;
  const linhas = R.talhoes.map(x => `<tr><td>${esc(x.t.nome)}${x.vars.length ? `<small>${esc(x.vars.join(', '))}</small>` : ''}</td><td>${x.n || '—'}</td><td>${x.n ? n0(x.kg) : '—'}</td><td><b>${x.n ? n0(x.sc) : '—'}</b></td><td><b>${x.scHa ? n1(x.scHa) : '—'}</b></td><td>${x.ha ? n1(x.ha) : '—'}</td><td>${x.dias || '—'}</td><td>${x.umid != null ? n1(x.umid) : '—'}</td></tr>`).join('');
  const p = S.params || PADRAO;
  return `<div class="pagehead"><h1>Resumo</h1><span>Safra ${esc(S.safra.nome)}</span></div>
  <div class="hero2 rise"><div class="hl"><span>Sacas colhidas (peso líquido ÷ 60)</span><b data-fit data-count="${scTot}">${n0(scTot)}</b><em>sc</em>
    <div class="hsub">${n0(l.length)} viagens · ${n1(kgTot / 1000)} t${umidMed == null ? '' : ' · umid. ' + n1(umidMed) + '%'}</div></div>
    <div class="hr">${anel(haTot ? haColh / haTot : 0, 'Hectares colhidos')}<small>ha colhidos</small></div></div>
  <div class="tiles four rise"><div class="tile"><span>Média geral</span><b data-fit>${haColh ? n1(scTot / haColh) : '—'}</b><em>sc/ha</em></div>
    <div class="tile"><span>Média dos talhões</span><b data-fit>${mTal.length ? n1(mediaTal) : '—'}</b><em>sc/ha</em></div>
    <div class="tile"><span>Colhidos</span><b data-fit>${n1(haColh)}</b><em>ha</em></div>
    <div class="tile"><span>Restantes</span><b data-fit>${n1(haRest)}</b><em>ha</em></div></div>
  ${haColh ? '' : '<div class="alerta">Para calcular as médias por hectare, informe os hectares colhidos de cada talhão na aba Talhões.</div>'}
  <div class="card"><h2>Por talhão</h2><div class="tscroll"><table class="rs"><tr><th>Talhão</th><th>Viagens</th><th>Peso líq. (kg)</th><th>Sacas</th><th>sc/ha</th><th>ha colh.</th><th>Dias</th><th>Umid. %</th></tr>${linhas}
  <tr class="tot"><td>TOTAL</td><td>${l.length}</td><td>${n0(kgTot)}</td><td>${n0(scTot)}</td><td>${haColh ? n1(scTot / haColh) : '—'}</td><td>${haColh ? n1(haColh) : '—'}</td><td>${new Set(l.map(c => c.data)).size}</td><td>${umidMed == null ? '—' : n1(umidMed)}</td></tr>
  <tr class="tot"><td>MÉDIA DOS TALHÕES</td><td></td><td></td><td></td><td>${mTal.length ? n1(mediaTal) : '—'}</td><td></td><td></td><td></td></tr></table></div></div>
  <div class="card"><h2>Média por tipo de soja</h2><div class="tscroll"><table class="rs"><tr><th>Tipo</th><th>Viagens</th><th>Sacas</th><th>ha</th><th>sc/ha</th></tr>${R.tipos.map(t => `<tr><td>${t.nome}</td><td>${t.n || '—'}</td><td>${t.sc ? n0(t.sc) : '—'}</td><td>${t.ha ? n1(t.ha) : '—'}</td><td>${t.scHa ? n1(t.scHa) : '—'}</td></tr>`).join('')}</table></div><div class="hint">Hectares = soma dos hectares colhidos informados nos talhões que receberam viagens daquele tipo.</div></div>
  <div class="card"><h2>Por variedade</h2><div class="tscroll"><table class="rs"><tr><th>Variedade</th><th>Tipo</th><th>Viagens</th><th>Sacas</th></tr>${R.variedades.map(v => `<tr><td>${esc(v.nome)}</td><td>${esc(v.tipo)}</td><td>${v.n}</td><td>${n0(v.sc)}</td></tr>`).join('') || '<tr><td colspan="4">Sem viagens.</td></tr>'}</table></div></div>
  <div class="acoes noprint">${acao('csvResumo', 'baixar', 'Baixar resumo', 'arquivo CSV')}${acao('imprimir', 'imprimir', 'Imprimir', 'ou salvar em PDF', 'am')}</div>`;
}
function exportarResumoCSV() {
  const R = dadosResumo();
  const cab = ['Talhão', 'Variedades', 'Viagens', 'Peso líquido kg', 'Sacas', 'sc/ha', 'ha colhidos', 'Dias', 'Umidade média %'];
  const lin = R.talhoes.map(x => [x.t.nome, x.vars.join(' / '), x.n, x.kg, x.sc.toFixed(2).replace('.', ','), x.scHa.toFixed(2).replace('.', ','), x.ha, x.dias, x.umid != null ? x.umid.toFixed(1).replace('.', ',') : '']);
  const csv = '﻿' + [cab, ...lin].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `resumo-safra-${S.safra.nome.replace('/', '-')}-${hoje()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Talhões ---------- */
function viewTalhoes() {
  const ger = S.perfil.papel === 'gerente';
  const l = ativas();
  return `<div class="pagehead"><h1>Talhões</h1><span>${S.talhoes.length} cadastrados</span></div>
  ${ger ? '<button class="btn" data-act="novoTal" style="margin-bottom:16px">Novo talhão</button>' : ''}
  <div class="card list">${S.talhoes.map(t => { const sc = soma(l.filter(c => c.talhao_id === t.id), 'sacas'); return `<button class="item" ${ger ? `data-tal="${t.id}"` : ''}><div class="n">${t.area_ha ? n0(t.area_ha) : '?'}<small style="font-size:10px">ha</small></div><div class="m"><b>${esc(t.nome)}${t.ativo ? '' : '<i class="badge">inativo</i>'}</b><small>${variedadeDe(t) ? esc(variedadeDe(t).nome) + ' · ' + esc(variedadeDe(t).tipo) : 'sem variedade'}</small></div><div class="v">${n0(sc)} sc<small>${t.area_colhida_ha && sc ? n1(sc / t.area_colhida_ha) + ' sc/ha' : (sc ? 'ha colhidos?' : 'não colhido')}</small></div></button>`; }).join('') || '<div class="empty">Nenhum talhão cadastrado.</div>'}</div>`;
}
function abrirTalhao(id) {
  const t = id ? S.talhoes.find(x => x.id === id) : {};
  sheet(`<h2>${id ? 'Editar talhão' : 'Novo talhão'}</h2><form id="fTalhao" data-id="${id || ''}">
  <div class="field"><label>Nome</label><input id="tNome" required value="${esc(t.nome || '')}"></div>
  <div class="field"><label>Área (ha)</label><input id="tHa" inputmode="decimal" value="${t.area_ha ?? ''}"></div>
  ${id ? ('area_colhida_ha' in t ? `<div class="field"><label>Hectares colhidos até agora</label><input id="tHaC" inputmode="decimal" value="${t.area_colhida_ha ?? 0}"><div class="hint">Restam ${n1(Math.max(Number(t.area_ha || 0) - Number(t.area_colhida_ha || 0), 0))} ha de ${n1(t.area_ha || 0)} ha. Atualize conforme a colheita avança.</div></div>` : '<div class="hint" style="margin-bottom:14px">Hectares colhidos: aguardando atualização do banco.</div>') : ''}
  <div class="field"><label>Variedade plantada</label><select id="tVar"><option value="">— a definir —</option>${['intacta', 'rr', 'convencional'].map(tp => `<optgroup label="${tp.toUpperCase()}">${S.variedades.filter(v => v.tipo === tp && (v.ativo || v.id === t.variedade_id)).map(v => `<option value="${v.id}" ${t.variedade_id === v.id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</optgroup>`).join('')}</select></div>
  ${id ? `<div class="field"><label>Situação</label><select id="tAtivo"><option value="1" ${t.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${!t.ativo ? 'selected' : ''}>Inativo</option></select></div>` : ''}
  <button class="btn" type="submit">Salvar</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}

/* ---------- Mais ---------- */
let instalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalar = e; if (S.user) render(); });
async function carregarUsuarios() {
  if (!S.perfil || S.perfil.papel !== 'gerente') return;
  const { data } = await sb.from('cs_perfis').select('*').order('nome'); if (data) S.usuarios = data;
}
function abrirSenha() {
  sheet(`<h2>Trocar minha senha</h2><form id="fSenha">
  <div class="field"><label>Nova senha</label><input id="sNova" type="password" autocomplete="new-password" minlength="6" required></div>
  <div class="field"><label>Repita a nova senha</label><input id="sConf" type="password" autocomplete="new-password" minlength="6" required></div>
  <button class="btn" type="submit">Salvar senha</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}
function abrirUsuario() {
  sheet(`<h2>Novo acesso</h2><form id="fUsuario" autocomplete="off">
  <div class="field"><label>Nome</label><input id="uNome" required></div>
  <div class="field"><label>E-mail (usado para entrar)</label><input id="uEmail" type="email" inputmode="email" autocapitalize="off" required></div>
  <div class="field"><label>Senha inicial</label><input id="uSenha" type="text" minlength="6" required><div class="hint">Mínimo 6 caracteres. Passe para a pessoa; ela pode trocar depois em Mais.</div></div>
  <div class="field"><label>Função</label><select id="uPapel"><option value="balanceiro">Balanceiro (lança cargas)</option><option value="gerente">Gerente / Patrão (tudo)</option></select></div>
  <button class="btn" type="submit">Criar acesso</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}
function abrirRedef(id) {
  const u = S.usuarios.find(x => x.id === id); if (!u) return;
  sheet(`<h2>Nova senha para ${esc(u.nome)}</h2><form id="fRedef" data-id="${u.id}" autocomplete="off">
  <div class="field"><label>Nova senha</label><input id="rSenha" type="text" minlength="6" required></div>
  <button class="btn" type="submit">Redefinir senha</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}
function cardDesconto(ger) {
  const p = S.params || PADRAO;
  const desc = p.modo === 'nenhum' ? 'Desconto desligado' : `Base ${n1(p.umidade_base)}% de umidade · impureza tolerada ${n1(p.impureza_tol)}%${p.modo === 'tabela' ? ` · ${n1(p.perc_por_ponto)}% por ponto` : ' · fórmula Aprosoja MS'}`;
  return `<div class="card"><h2>Desconto de umidade e impureza</h2><div class="hint" style="margin:0 0 8px">${desc}</div><div class="hint" style="margin:0 0 12px">${esc(p.origem || 'Padrão de mercado — confirmar com o comprador')}</div>${ger ? '<button class="btn sec" data-act="descontoCfg">Editar parâmetros</button>' : ''}</div>`;
}
function abrirDesconto() {
  const p = S.params || PADRAO;
  sheet(`<h2>Desconto de umidade e impureza</h2><form id="fDesc">
  <div class="field"><label>Cálculo</label><select id="dModo"><option value="formula" ${p.modo === 'formula' ? 'selected' : ''}>Fórmula (proporcional ao excesso)</option><option value="tabela" ${p.modo === 'tabela' ? 'selected' : ''}>Percentual por ponto de umidade</option><option value="nenhum" ${p.modo === 'nenhum' ? 'selected' : ''}>Sem desconto</option></select></div>
  <div class="row2"><div class="field"><label>Umidade base %</label><input id="dBase" inputmode="decimal" value="${p.umidade_base}"></div><div class="field"><label>Impureza tolerada %</label><input id="dTol" inputmode="decimal" value="${p.impureza_tol}"></div></div>
  <div class="field"><label>% por ponto (só no modo percentual)</label><input id="dPonto" inputmode="decimal" value="${p.perc_por_ponto}"></div>
  <div class="field"><label>Origem desta tabela</label><input id="dOrigem" value="${esc(p.origem || '')}" placeholder="ex.: Cooperativa X, safra 2026/27"></div>
  <button class="btn" type="submit">Salvar</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}
function cardVeiculos(ger) {
  return `<div class="card"><h2>Veículos</h2><div class="list">${S.veiculos.map(v => `<button class="item" ${ger ? `data-act="editVei" data-id="${esc(v.placa)}"` : ''}><div class="n" style="font-size:11px">${esc(v.placa.slice(0, 4))}</div><div class="m"><b>${esc(v.placa)}${v.ativo ? '' : '<i class="badge">inativo</i>'}</b><small>${[v.transportadora, v.motorista].filter(Boolean).map(esc).join(' · ') || 'sem transportadora'}</small></div><div class="v">${v.tara_padrao ? n0(v.tara_padrao) + ' kg' : '—'}<small>tara padrão</small></div></button>`).join('') || '<div class="empty">Nenhum veículo cadastrado.</div>'}</div><button class="btn sec" style="margin-top:12px" data-act="novoVei">Novo veículo</button></div>`;
}
function abrirVeiculo(placa) {
  const v = placa ? S.veiculos.find(x => x.placa === placa) : {};
  sheet(`<h2>${placa ? 'Editar veículo' : 'Novo veículo'}</h2><form id="fVei" data-placa="${esc(placa)}" autocomplete="off">
  <div class="field"><label>Placa / equipamento</label><input id="vPlaca" class="up" required maxlength="12" value="${esc(v.placa || '')}" ${placa ? 'readonly' : ''}></div>
  <div class="field"><label>Tara padrão (kg)</label><input id="vTara" inputmode="numeric" value="${v.tara_padrao ?? ''}"></div>
  <div class="field"><label>Transportadora</label><input id="vTransp" value="${esc(v.transportadora || '')}"></div>
  <div class="field"><label>Motorista</label><input id="vMot" value="${esc(v.motorista || '')}"></div>
  ${placa ? `<div class="field"><label>Situação</label><select id="vAtivo"><option value="1" ${v.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${!v.ativo ? 'selected' : ''}>Inativo</option></select></div>` : ''}
  <button class="btn" type="submit">Salvar</button></form><button class="btn sec" style="margin-top:10px" data-act="fechar">Cancelar</button>`);
}
function viewMais() {
  const ger = S.perfil.papel === 'gerente';
  const usuarios = ger ? `<div class="card"><h2>Usuários</h2><div class="list">${S.usuarios.map(u => `<div class="item"><div class="n">${esc((u.nome || '?').slice(0, 1))}</div><div class="m"><b>${esc(u.nome)}${u.ativo ? '' : '<i class="badge">desativado</i>'}</b><small>${u.papel === 'gerente' ? 'Gerente / Patrão' : 'Balanceiro'}</small></div><div style="display:flex;gap:6px"><button class="btn sec sm" data-act="redefinir" data-id="${u.id}">Senha</button>${u.id === S.user.id ? '' : `<button class="btn sec sm" data-act="ativar" data-id="${u.id}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`}</div></div>`).join('') || '<div class="empty">Carregando…</div>'}</div><button class="btn" style="margin-top:12px" data-act="novoUsuario">Novo acesso</button></div>` : '';
  return `<div class="pagehead"><h1>Mais</h1></div>
  <div class="card"><h2>Conta</h2><div class="kv"><span>Usuário</span><b>${esc(S.perfil.nome)}</b></div><div class="kv"><span>Função</span><b>${ger ? 'Gerente / Patrão' : 'Balanceiro'}</b></div><div class="kv"><span>E-mail</span><b>${esc(S.user.email)}</b></div>
  <button class="btn sec" style="margin-top:12px" data-act="trocarSenha">Trocar minha senha</button></div>
  ${usuarios}
  ${cardVeiculos(ger)}
  <div class="card"><h2>Sincronização</h2><div class="kv"><span>Cargas aguardando envio</span><b>${S.fila.length}</b></div><div class="kv"><span>Internet</span><b>${S.online ? 'Conectado' : 'Sem conexão'}</b></div>
  <div style="display:grid;gap:10px;margin-top:14px"><button class="btn sec" data-act="sync">Sincronizar agora</button><button class="btn sec" data-act="csv">Baixar planilha (CSV)</button>${instalar ? '<button class="btn yel" data-act="instalar">Instalar aplicativo</button>' : ''}</div></div>
  <button class="btn red" data-act="sair">Sair da conta</button>`;
}

/* ---------- Sheet ---------- */
function sheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="box">${html}</div>`; s.hidden = false; }
const fechar = () => { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; };

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-tab],[data-carga],[data-tal],[data-per],[data-act],#lSair');
  if (e.target.id === 'sheet') return fechar();
  if (!el) return;
  if (el.dataset.tab) { S.animar = el.dataset.tab !== S.tab; S.tab = el.dataset.tab; ls.set('cs_tab', S.tab); render(); window.scrollTo(0, 0); if (S.tab === 'mais') carregarUsuarios().then(() => { if (S.tab === 'mais') render(); }); }
  else if (el.dataset.carga) abrirCarga(el.dataset.carga);
  else if (el.dataset.tal) abrirTalhao(el.dataset.tal);
  else if (el.dataset.per) { S.periodo = el.dataset.per; render(); }
  else if (el.id === 'lSair' || el.dataset.act === 'sair') { if (S.fila.length && !confirm('Há cargas ainda não enviadas neste aparelho. Sair mesmo assim?')) return; await sb.auth.signOut(); }
  else {
    const a = el.dataset.act;
    if (a === 'fechar') fechar();
    else if (a === 'verSenha') { const i = $('#lSenha'); const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; el.textContent = ver ? 'Ocultar' : 'Ver'; }
    else if (a === 'trocarSenha') abrirSenha();
    else if (a === 'novoUsuario') abrirUsuario();
    else if (a === 'redefinir') abrirRedef(el.dataset.id);
    else if (a === 'ativar') {
      const u = S.usuarios.find(x => x.id === el.dataset.id); if (!u) return;
      if (u.id === S.user.id) return toast('Você não pode desativar o seu próprio acesso.', true);
      const { error } = await sb.from('cs_perfis').update({ ativo: !u.ativo }).eq('id', u.id);
      if (error) return toast(traduz(error), true);
      await carregarUsuarios(); render(); toast(u.ativo ? 'Acesso desativado' : 'Acesso reativado');
    }
    else if (a === 'csv') exportarCSV();
    else if (a === 'csvResumo') exportarResumoCSV();
    else if (a === 'zapCarga') compartilhaViagem(el.dataset.id);
    else if (a === 'reusarNumero') { S.viagemForcada = parseInt(el.dataset.n, 10); fechar(); S.tab = 'lancar'; render(); toast('A próxima viagem será a ' + S.viagemForcada); }
    else if (a === 'reabrirDia') {
      if (!confirm(`Reabrir ${brData(S.dia)}? Depois disso será possível lançar e cancelar viagens deste dia de novo.`)) return;
      const { data: rem, error } = await sb.from('cs_fechamentos').delete().eq('safra_id', S.safra.id).eq('data', S.dia).select('data');
      if (error) return toast(traduz(error), true);
      if (!rem || !rem.length) return toast('Não foi possível reabrir o dia (sem permissão).', true);
      S.fech = S.fech.filter(d => d !== S.dia); await carregar(); render(); toast('Dia reaberto');
    }
    else if (a === 'zapDia') window.open('https://wa.me/?text=' + encodeURIComponent(textoDia(resumoDia(S.dia))), '_blank');
    else if (a === 'fecharDia') {
      const r = resumoDia(S.dia);
      if (S.fila.length && !confirm('Há viagens ainda não enviadas. Envie-as antes de fechar o dia.')) return;
      if (!confirm(`Fechar ${brData(S.dia)}? ${r.viagens} viagens, ${n0(r.sacas)} sacas. Depois de fechado ninguém consegue lançar ou alterar viagens deste dia.`)) return;
      const { error } = await sb.from('cs_fechamentos').insert({ safra_id: S.safra.id, data: S.dia, resumo: r });
      if (error) return toast(traduz(error), true);
      S.fech.push(S.dia); render(); toast('Dia fechado');
      window.open('https://wa.me/?text=' + encodeURIComponent(textoDia(r)), '_blank');
    }
    else if (a === 'descontoCfg') abrirDesconto();
    else if (a === 'novoVei') abrirVeiculo('');
    else if (a === 'editVei') abrirVeiculo(el.dataset.id);
    else if (a === 'imprimir') window.print();
    else if (a === 'zap') resumoZap();
    else if (a === 'sync') { await enviarFila(); await carregar(); render(); toast(S.online ? 'Dados atualizados' : 'Sem conexão', !S.online); }
    else if (a === 'instalar' && instalar) { instalar.prompt(); instalar = null; }
    else if (a === 'novoTal') abrirTalhao('');
    else if (a === 'descartar') { S.fila = S.fila.filter(x => x.client_id !== el.dataset.id); salvaFila(); fechar(); render(); toast('Carga descartada'); }
    else if (a === 'cancelar') {
      const motivo = ($('#cMotivo').value || '').trim(); if (!motivo) return toast('Informe o motivo.', true);
      const { data: alt, error } = await sb.from('cs_cargas').update({ status: 'cancelada', motivo_cancelamento: motivo }).eq('id', el.dataset.id).select('id');
      if (error) return toast(traduz(error), true);
      if (!alt || !alt.length) return toast('Não foi possível cancelar: o dia está fechado ou você não tem permissão. O gerente pode reabrir o dia na aba Viagens.', true);
      fechar(); await carregar(); render(); toast('Carga cancelada');
    }
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'dDia') { S.dia = e.target.value || hoje(); render(); }
  if (e.target.id === 'fTal') { S.fTalhao = e.target.value; render(); }
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'fLogin') {
    e.preventDefault(); if (S.entrando) return;
    const email = $('#lEmail').value.trim().toLowerCase(), senha = $('#lSenha').value;
    S.entrando = true; S.erroLogin = ''; render();
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    S.entrando = false;
    if (error) { S.erroLogin = traduz(error); render(); const i = $('#lEmail'); if (i) i.value = email; return; }
    ls.set('cs_email', email);
  }
  if (e.target.id === 'fSenha') {
    e.preventDefault(); const n = $('#sNova').value, c = $('#sConf').value;
    if (n.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', true);
    if (n !== c) return toast('As duas senhas não são iguais.', true);
    const { error } = await sb.auth.updateUser({ password: n });
    if (error) return toast(traduz(error), true);
    fechar(); toast('Senha alterada');
  }
  if (e.target.id === 'fUsuario') {
    e.preventDefault(); const f = e.target;
    const r = { p_email: $('#uEmail').value.trim(), p_senha: $('#uSenha').value, p_nome: $('#uNome').value.trim(), p_papel: $('#uPapel').value };
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const { error } = await sb.rpc('cs_criar_usuario', r);
    btn.disabled = false;
    if (error) return toast(traduz(error), true);
    fechar(); await carregarUsuarios(); render(); toast('Acesso criado para ' + r.p_nome);
  }
  if (e.target.id === 'fRedef') {
    e.preventDefault(); const n = $('#rSenha').value;
    const { error } = await sb.rpc('cs_redefinir_senha', { p_perfil: e.target.dataset.id, p_senha: n });
    if (error) return toast(traduz(error), true);
    fechar(); toast('Senha redefinida');
  }
  if (e.target.id === 'fDesc') {
    e.preventDefault(); const f = x => parseFloat(String($(x).value).replace(',', '.'));
    const row = { safra_id: S.safra.id, modo: $('#dModo').value, umidade_base: f('#dBase'), impureza_tol: f('#dTol'), perc_por_ponto: f('#dPonto'), origem: $('#dOrigem').value.trim() || 'Definido pelo gerente', atualizado_em: new Date().toISOString() };
    if ([row.umidade_base, row.impureza_tol, row.perc_por_ponto].some(x => Number.isNaN(x))) return toast('Confira os números.', true);
    const { error } = await sb.from('cs_parametros').upsert(row);
    if (error) return toast(traduz(error), true);
    S.params = row; fechar(); render(); toast('Parâmetros salvos');
  }
  if (e.target.id === 'fVei') {
    e.preventDefault(); const nova = !e.target.dataset.placa, placa = normPlaca($('#vPlaca').value), tara = parseInt($('#vTara').value.replace(/\D/g, ''), 10);
    if (placa.length < 3) return toast('Informe a placa.', true);
    const row = { placa, tara_padrao: tara > 0 ? tara : null, transportadora: $('#vTransp').value.trim() || null, motorista: $('#vMot').value.trim() || null };
    if (!nova) row.ativo = $('#vAtivo').value === '1';
    const { error } = nova ? await sb.from('cs_veiculos').insert(row) : await sb.from('cs_veiculos').update(row).eq('placa', placa);
    if (error) return toast(traduz(error), true);
    fechar(); await carregar(); render(); toast('Veículo salvo');
  }
  if (e.target.id === 'fTalhao') {
    e.preventDefault(); const id = e.target.dataset.id;
    const ha = String($('#tHa').value).replace(',', '.').trim();
    const row = { nome: $('#tNome').value.trim(), variedade_id: $('#tVar').value || null, area_ha: ha === '' ? null : parseFloat(ha) };
    if (!row.nome) return toast('Informe o nome.', true);
    if (id && $('#tHaC')) { const hc = String($('#tHaC').value).replace(',', '.').trim(); row.area_colhida_ha = hc === '' ? 0 : parseFloat(hc); if (!(row.area_colhida_ha >= 0)) return toast('Hectares colhidos inválidos.', true); }
    if (id) row.ativo = $('#tAtivo').value === '1'; else row.safra_id = S.safra.id;
    const { error } = id ? await sb.from('cs_talhoes').update(row).eq('id', id) : await sb.from('cs_talhoes').insert(row);
    if (error) return toast(error.code === '23505' ? 'Já existe um talhão com esse nome.' : traduz(error), true);
    fechar(); await carregar(); render(); toast('Talhão salvo');
  }
});
window.addEventListener('online', () => { S.online = true; enviarFila().then(() => { carregar().then(render); }); render(); });
window.addEventListener('offline', () => { S.online = false; render(); });
document.addEventListener('visibilitychange', async () => { if (!document.hidden && S.user && S.tab !== 'lancar') { await enviarFila(); await carregar(); render(); } });
setInterval(async () => { if (!document.hidden && S.user && S.perfil && navigator.onLine && !['lancar'].includes(S.tab) && $('#sheet').hidden) { await enviarFila(); await carregar(); render(); } }, 60000);

/* ---------- Início ---------- */
async function iniciar() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  const { data } = await sb.auth.getSession();
  S.user = data.session ? data.session.user : null;
  sb.auth.onAuthStateChange(async (_ev, session) => {
    const novo = session ? session.user : null;
    if (novo && (!S.user || S.user.id !== novo.id)) { S.user = novo; await carregarPerfil(); await carregar(); render(); enviarFila(); }
    else if (!novo && S.user) {
      S.user = null; S.perfil = null; S.cargas = []; S.talhoes = []; S.variedades = []; S.usuarios = []; S.params = null; S.veiculos = []; S.fech = []; S.safra = null;
      try { localStorage.removeItem('cs_cache'); localStorage.removeItem('cs_perfil'); } catch { } /* aparelho compartilhado: não deixa dados da conta */
      render();
    }
  });
  if (S.user) { S.perfil = ls.get('cs_perfil', null); const c = ls.get('cs_cache', null); if (c) { S.safra = c.safra; S.talhoes = c.talhoes; S.cargas = c.cargas; S.variedades = c.variedades || []; S.params = c.params || null; S.veiculos = c.veiculos || []; } render(); await carregarPerfil(); await carregar(); render(); enviarFila(); }
  else render();
}
iniciar();
