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
const fmtPlaca = p => p;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

const S = {
  user: null, perfil: null, safra: null, talhoes: [], variedades: [], cargas: [], fila: ls.get('cs_fila', []),
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
    ls.set('cs_cache', { safra: S.safra, talhoes: S.talhoes, cargas: S.cargas, variedades: S.variedades });
    S.online = true;
  } catch (e) {
    const c = ls.get('cs_cache', null);
    if (c && !S.safra) { S.safra = c.safra; S.talhoes = c.talhoes; S.cargas = c.cargas; S.variedades = c.variedades || []; }
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
  if (ok) { toast(ok + (ok > 1 ? ' cargas sincronizadas' : ' carga sincronizada')); await carregar(); }
  render();
}
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
  more: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};
const ico = k => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;

/* ---------- Render raiz ---------- */
function render() {
  const app = $('#app');
  if (!S.user) return app.innerHTML = telaLogin();
  if (!S.perfil) return app.innerHTML = telaSemAcesso();
  const tabs = [['lancar', 'Lançar', 'plus'], ['cargas', 'Cargas', 'list'], ['painel', 'Dashboard', 'chart'], ['talhoes', 'Talhões', 'field'], ['mais', 'Mais', 'more']];
  const nf = S.fila.length;
  const nav = tabs.map(([k, l, i]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${ico(i)}<span>${l}</span>${k === 'mais' && nf ? `<i class="dot">${nf}</i>` : ''}</button>`).join('');
  const net = `<span class="net ${S.online ? '' : 'off'}">${S.online ? (nf ? nf + ' a enviar' : 'Conectado') : 'Sem internet' + (nf ? ' · ' + nf + ' salvas' : '')}</span>`;
  const f = { lancar: viewLancar, cargas: viewCargas, painel: viewPainel, talhoes: viewTalhoes, mais: viewMais }[S.tab];
  const scrollY = window.scrollY;
  const keep = S.tab === 'lancar' ? snapshotForm() : null;
  app.innerHTML = `<div class="shell">
    <header class="top"><div><b>Controle de Safra</b><small>Fazenda Lagoa Formosa${S.safra ? ' · ' + esc(S.safra.nome) : ''}</small></div>${net}</header>
    <aside class="side"><div class="brand"><b>Controle de Safra</b><small>Fazenda Lagoa Formosa${S.safra ? '<br>Safra ' + esc(S.safra.nome) : ''}</small></div><nav class="tabbar" id="tabbar">${nav}</nav></aside>
    <div class="body"><main>${!S.safra ? '<div class="card empty">Nenhuma safra aberta. Peça ao gerente para abrir a safra.</div>' : f()}</main></div></div>`;
  if (keep) restoreForm(keep);
  window.scrollTo(0, scrollY);
  if (S.tab === 'lancar') bindLancar();
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

/* ---------- Lançar carga ---------- */
function snapshotForm() { const f = $('#fCarga'); if (!f) return null; return Object.fromEntries([...f.elements].filter(e => e.id).map(e => [e.id, e.value])); }
function restoreForm(v) { for (const [k, val] of Object.entries(v)) { const e = document.getElementById(k); if (e) e.value = val; } }
const ultimoPorPlaca = placa => { const c = todasCargas().find(x => x.placa === placa); return c ? c.tara : null; };
function proxViagem() { return todasCargas().reduce((m, c) => Math.max(m, c.viagem || 0), 0) + 1; }
function viewLancar() {
  const placas = [...new Set(todasCargas().map(c => c.placa))].sort();
  const tal = S.talhoes.filter(t => t.ativo);
  const last = ls.get('cs_ult', {});
  if (!tal.length) return `<div class="card empty">Nenhum talhão cadastrado nesta safra ainda.<br>O gerente precisa cadastrar os talhões primeiro.</div>`;
  return `<div class="pagehead"><h1>Lançar carga</h1><span>${brData(hoje())} · ${agoraHora()}</span></div>
  <form id="fCarga" class="card" autocomplete="off">
    <div class="field"><label>Talhão</label><select id="cTal" required><option value="">Selecione o talhão…</option>${tal.map(t => `<option value="${t.id}" ${last.tal === t.id ? 'selected' : ''}>${esc(t.nome)}${variedadeDe(t) ? ' · ' + esc(variedadeDe(t).nome) : ''}</option>`).join('')}</select></div>
    <div class="row2"><div class="field"><label>Placa / equipamento</label><input id="cPlaca" class="up" list="dlPlacas" required maxlength="14" autocapitalize="characters"><datalist id="dlPlacas">${placas.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    <div class="field"><label>Nº da viagem</label><input id="cViagem" inputmode="numeric" pattern="[0-9]*" value="${proxViagem()}" required></div></div>
    <div class="row2"><div class="field"><label>Tara (kg)</label><input id="cTara" inputmode="numeric" pattern="[0-9]*" required><div class="hint" id="hTara"></div></div>
    <div class="field"><label>Peso bruto (kg)</label><input id="cBruto" inputmode="numeric" pattern="[0-9]*" required></div></div>
    <div class="field"><label>Umidade % (opcional)</label><input id="cUmid" inputmode="decimal" placeholder="ex.: 13,5"></div>
    <div class="preview" id="prev"><div><span>Peso líquido</span><b>0 <small>kg</small></b></div><div><span>Sacas (60 kg)</span><b>0,0 <small>sc</small></b></div></div>
    <button class="btn" type="submit">Salvar carga</button>
  </form>
  <div class="card"><h2>Últimas cargas</h2><div class="list">${todasCargas().slice(0, 5).map(itemCarga).join('') || '<div class="empty">Nenhuma carga lançada ainda.</div>'}</div></div>`;
}
function bindLancar() {
  const g = id => document.getElementById(id); if (!g('fCarga')) return;
  const num = id => parseInt(String(g(id).value).replace(/\D/g, ''), 10) || 0;
  const calc = () => {
    const l = num('cBruto') - num('cTara'); const bad = num('cBruto') && num('cTara') && l <= 0;
    g('prev').innerHTML = `<div class="${bad ? 'bad' : ''}"><span>${bad ? 'Bruto menor que a tara!' : 'Peso líquido'}</span><b>${n0(Math.max(l, 0))} <small>kg</small></b></div><div class="${bad ? 'bad' : ''}"><span>Sacas (60 kg)</span><b>${n1(Math.max(l, 0) / 60)} <small>sc</small></b></div>`;
  };
  g('cPlaca').addEventListener('input', e => {
    e.target.value = normPlaca(e.target.value);
    const t = ultimoPorPlaca(e.target.value);
    if (t) { g('hTara').textContent = 'Última tara deste veículo: ' + n0(t) + ' kg (toque para usar)'; g('hTara').dataset.t = t; } else { g('hTara').textContent = ''; delete g('hTara').dataset.t; }
  });
  g('hTara').addEventListener('click', () => { if (g('hTara').dataset.t) { g('cTara').value = g('hTara').dataset.t; calc(); g('cBruto').focus(); } });
  g('cTara').addEventListener('input', calc); g('cBruto').addEventListener('input', calc);
  g('fCarga').addEventListener('submit', async ev => {
    ev.preventDefault();
    const placa = normPlaca(g('cPlaca').value), tara = num('cTara'), bruto = num('cBruto'), viagem = num('cViagem');
    const u = String(g('cUmid').value).replace(',', '.').trim(); const umid = u === '' ? null : parseFloat(u);
    if (!g('cTal').value) return toast('Escolha o talhão.', true);
    if (placa.length < 3) return toast('Informe a placa.', true);
    if (!viagem) return toast('Informe o nº da viagem.', true);
    if (!tara || !bruto) return toast('Informe tara e peso bruto.', true);
    if (bruto <= tara) return toast('O peso bruto precisa ser maior que a tara.', true);
    if (umid !== null && !(umid >= 0 && umid <= 60)) return toast('Umidade inválida.', true);
    if (bruto - tara > 80000) { if (!confirm('Peso líquido acima de 80.000 kg. Confirmar mesmo assim?')) return; }
    if (todasCargas().some(c => c.status === 'ativa' && c.viagem === viagem && c.placa === placa && c.data === hoje())) { if (!confirm('Já existe a viagem ' + viagem + ' desta placa hoje. Lançar mesmo assim?')) return; }
    const r = { client_id: uuid(), safra_id: S.safra.id, talhao_id: g('cTal').value, data: hoje(), hora: agoraHora(), viagem, placa, tara, bruto, umidade: umid };
    S.fila.push(r); salvaFila(); ls.set('cs_ult', { tal: r.talhao_id });
    toast('Carga salva — ' + n1((bruto - tara) / 60) + ' sacas');
    S.tab = 'lancar'; render();
    g('cPlaca') && document.getElementById('cPlaca').focus();
    enviarFila();
  });
  calc();
}

/* ---------- Lista de cargas ---------- */
const variedadeDe = t => S.variedades.find(v => v.id === t.variedade_id) || null;
const nomeTal = id => (S.talhoes.find(t => t.id === id) || {}).nome || '—';
function itemCarga(c) {
  return `<button class="item ${c.status === 'cancelada' ? 'canc' : ''}" data-carga="${c.id}"><div class="n">${c.viagem ?? '·'}</div>
  <div class="m"><b>${esc(c.placa)}${c._pend ? '<i class="badge">a enviar</i>' : ''}</b><small>${esc(nomeTal(c.talhao_id))} · ${brData(c.data)} ${(c.hora || '').slice(0, 5)}</small></div>
  <div class="v">${n1(c.sacas)} sc<small>${n0(c.liquido)} kg</small></div></button>`;
}
function viewCargas() {
  const lista = todasCargas().filter(c => c.data === S.dia);
  const at = lista.filter(c => c.status === 'ativa');
  return `<div class="pagehead"><h1>Cargas</h1><span>${at.length} cargas · ${n1(at.reduce((a, c) => a + Number(c.sacas), 0))} sc</span></div>
  <div class="card"><div class="field" style="margin:0"><label>Dia</label><input type="date" id="dDia" value="${S.dia}"></div></div>
  <div class="card list">${lista.map(itemCarga).join('') || '<div class="empty">Nenhuma carga neste dia.</div>'}</div>`;
}
function abrirCarga(id) {
  const c = todasCargas().find(x => String(x.id) === id); if (!c) return;
  const pode = S.perfil.papel === 'gerente' || (c.data >= diasAtras(1));
  sheet(`<h2>Viagem ${c.viagem ?? ''} · ${esc(c.placa)}</h2>
  <div class="kv"><span>Talhão</span><b>${esc(nomeTal(c.talhao_id))}</b></div>
  <div class="kv"><span>Data e hora</span><b>${brData(c.data)} ${(c.hora || '').slice(0, 5)}</b></div>
  <div class="kv"><span>Tara</span><b>${n0(c.tara)} kg</b></div><div class="kv"><span>Peso bruto</span><b>${n0(c.bruto)} kg</b></div>
  <div class="kv"><span>Peso líquido</span><b>${n0(c.liquido)} kg</b></div><div class="kv"><span>Sacas</span><b>${n1(c.sacas)}</b></div>
  <div class="kv"><span>Umidade</span><b>${c.umidade != null ? n1(c.umidade) + '%' : '—'}</b></div>
  ${c.status === 'cancelada' ? `<div class="msg" style="margin-top:12px">Cancelada: ${esc(c.motivo_cancelamento)}</div>` : ''}
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
  const areaTot = soma(S.talhoes.filter(t => t.ativo), 'area_ha');
  /* por talhão */
  const porTal = S.talhoes.map(t => { const c = l.filter(x => x.talhao_id === t.id); const sc = soma(c, 'sacas'); return { t, sc, n: c.length, ha: Number(t.area_ha || 0), pr: t.area_ha ? sc / t.area_ha : 0 }; }).filter(x => x.sc > 0).sort((a, b) => b.pr - a.pr);
  const maxPr = Math.max(1, ...porTal.map(x => x.pr));
  const haColh = porTal.reduce((a, x) => a + x.ha, 0);
  const prod = haColh ? porTal.reduce((a, x) => a + x.sc, 0) / haColh : 0;
  /* por dia */
  const dias = {}; l.forEach(c => { dias[c.data] = (dias[c.data] || 0) + Number(c.sacas); });
  const dk = Object.keys(dias).sort().slice(-14), maxD = Math.max(1, ...dk.map(d => dias[d]));
  const W = 600, H = 170, bw = W / Math.max(dk.length, 1);
  const bars = dk.map((d, i) => { const h = Math.max(2, dias[d] / maxD * (H - 36)); return `<rect class="b" x="${i * bw + bw * .15}" y="${H - 22 - h}" width="${bw * .7}" height="${h}" rx="4"/><text x="${i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${d.slice(8)}/${d.slice(5, 7)}</text><text x="${i * bw + bw / 2}" y="${H - 26 - h}" text-anchor="middle">${n0(dias[d])}</text>`; }).join('');
  /* por veículo */
  const vei = {}; l.forEach(c => { const v = vei[c.placa] ||= { n: 0, sc: 0 }; v.n++; v.sc += Number(c.sacas); });
  const veic = Object.entries(vei).sort((a, b) => b[1].sc - a[1].sc);
  /* umidade */
  const faixas = [['até 13%', 0, 13], ['13–15%', 13, 15], ['15–18%', 15, 18], ['acima de 18%', 18, 99]];
  const fu = faixas.map(([n, a, b]) => [n, comU.filter(c => c.umidade > a - (a === 0 ? 1 : 0) && c.umidade <= b).length]);
  /* por tipo / variedade */
  const vr = {}; l.forEach(c => { const t = S.talhoes.find(x => x.id === c.talhao_id); const k = (t && variedadeDe(t) && variedadeDe(t).nome) || 'Sem variedade'; vr[k] = (vr[k] || 0) + Number(c.sacas); });
  const varied = Object.entries(vr).sort((a, b) => b[1] - a[1]);
  const maxV = Math.max(1, ...varied.map(x => x[1]));
  const per = [['hoje', 'Hoje'], ['7d', '7 dias'], ['safra', 'Safra toda']].map(([k, n]) => `<button data-per="${k}" class="${S.periodo === k ? 'on' : ''}">${n}</button>`).join('');
  return `<div class="pagehead"><h1>Dashboard</h1><span>Safra ${esc(S.safra.nome)}</span></div>
  <div class="chips">${per}</div>
  <div class="card"><label>Talhão</label><select id="fTal"><option value="">Todos os talhões</option>${S.talhoes.map(t => `<option value="${t.id}" ${S.fTalhao === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
  <div class="kpis"><div class="kpi g"><span>Sacas colhidas</span><b>${n0(sacas)} <small>sc</small></b></div>
  <div class="kpi"><span>Toneladas</span><b>${n1(kg / 1000)} <small>t</small></b></div>
  <div class="kpi"><span>Cargas</span><b>${n0(l.length)}</b></div>
  <div class="kpi y"><span>Produtividade média</span><b>${n1(prod)} <small>sc/ha</small></b></div>
  <div class="kpi"><span>Média por carga</span><b>${n1(l.length ? sacas / l.length : 0)} <small>sc</small></b></div>
  <div class="kpi"><span>Umidade média</span><b>${umid == null ? '—' : n1(umid) + ' <small>%</small>'}</b></div></div>
  <div class="grid2"><div class="card chart"><h2>Sacas por dia</h2>${dk.length ? `<svg viewBox="0 0 ${W} ${H}">${bars}</svg>` : '<div class="empty">Sem cargas no período.</div>'}</div>
  <div class="card"><h2>Talhões com colheita</h2><div class="kpi g" style="border:0;padding:0;background:none"><b style="font-size:34px">${porTal.length}<small> de ${S.talhoes.filter(t => t.ativo).length}</small></b></div><div class="hint">${n1(haColh)} ha de ${n1(areaTot)} ha cadastrados</div></div></div>
  <div class="card"><h2>Produtividade por talhão (sc/ha)</h2>${porTal.map(x => `<div class="bar"><div class="lb">${esc(x.t.nome)}</div><div class="tr"><i style="width:${x.pr / maxPr * 100}%"></i></div><div class="vl"><b>${n1(x.pr)}</b> · ${n0(x.sc)} sc</div></div>`).join('') || '<div class="empty">Sem dados no período.</div>'}</div>
  <div class="grid2"><div class="card"><h2>Por variedade</h2>${varied.map(([k, v]) => `<div class="bar"><div class="lb">${esc(k)}</div><div class="tr"><i style="width:${v / maxV * 100}%"></i></div><div class="vl">${n0(v)} sc</div></div>`).join('') || '<div class="empty">—</div>'}</div>
  <div class="card"><h2>Umidade das cargas</h2>${comU.length ? fu.map(([k, v]) => `<div class="bar"><div class="lb">${k}</div><div class="tr"><i style="width:${v / Math.max(1, comU.length) * 100}%"></i></div><div class="vl">${v} cargas</div></div>`).join('') : '<div class="empty">Nenhuma umidade informada.</div>'}</div></div>
  <div class="card"><h2>Por veículo</h2>${veic.length ? `<table><tr><th>Placa</th><th>Cargas</th><th>Sacas</th><th>Média/carga</th></tr>${veic.map(([p, v]) => `<tr><td>${esc(p)}</td><td>${v.n}</td><td>${n0(v.sc)}</td><td>${n1(v.sc / v.n)} sc</td></tr>`).join('')}</table>` : '<div class="empty">Sem dados.</div>'}</div>
  <div class="row2"><button class="btn sec" data-act="csv">Baixar planilha (CSV)</button><button class="btn yel" data-act="zap">Resumo no WhatsApp</button></div>`;
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

/* ---------- Talhões ---------- */
function viewTalhoes() {
  const ger = S.perfil.papel === 'gerente';
  const l = ativas();
  return `<div class="pagehead"><h1>Talhões</h1><span>${S.talhoes.length} cadastrados</span></div>
  ${ger ? '<button class="btn" data-act="novoTal" style="margin-bottom:16px">Novo talhão</button>' : ''}
  <div class="card list">${S.talhoes.map(t => { const sc = soma(l.filter(c => c.talhao_id === t.id), 'sacas'); return `<button class="item" ${ger ? `data-tal="${t.id}"` : ''}><div class="n">${t.area_ha ? n0(t.area_ha) : '?'}<small style="font-size:10px">ha</small></div><div class="m"><b>${esc(t.nome)}${t.ativo ? '' : '<i class="badge">inativo</i>'}</b><small>${variedadeDe(t) ? esc(variedadeDe(t).nome) + ' · ' + esc(variedadeDe(t).tipo) : 'sem variedade'}</small></div><div class="v">${n0(sc)} sc<small>${t.area_ha && sc ? n1(sc / t.area_ha) + ' sc/ha' : 'não colhido'}</small></div></button>`; }).join('') || '<div class="empty">Nenhum talhão cadastrado.</div>'}</div>`;
}
function abrirTalhao(id) {
  const t = id ? S.talhoes.find(x => x.id === id) : {};
  sheet(`<h2>${id ? 'Editar talhão' : 'Novo talhão'}</h2><form id="fTalhao" data-id="${id || ''}">
  <div class="field"><label>Nome</label><input id="tNome" required value="${esc(t.nome || '')}"></div>
  <div class="field"><label>Área (ha)</label><input id="tHa" inputmode="decimal" value="${t.area_ha ?? ''}"></div>
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
function viewMais() {
  const ger = S.perfil.papel === 'gerente';
  const usuarios = ger ? `<div class="card"><h2>Usuários</h2><div class="list">${S.usuarios.map(u => `<div class="item"><div class="n">${esc((u.nome || '?').slice(0, 1))}</div><div class="m"><b>${esc(u.nome)}${u.ativo ? '' : '<i class="badge">desativado</i>'}</b><small>${u.papel === 'gerente' ? 'Gerente / Patrão' : 'Balanceiro'}</small></div><div style="display:flex;gap:6px"><button class="btn sec sm" data-act="redefinir" data-id="${u.id}">Senha</button>${u.id === S.user.id ? '' : `<button class="btn sec sm" data-act="ativar" data-id="${u.id}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`}</div></div>`).join('') || '<div class="empty">Carregando…</div>'}</div><button class="btn" style="margin-top:12px" data-act="novoUsuario">Novo acesso</button></div>` : '';
  return `<div class="pagehead"><h1>Mais</h1></div>
  <div class="card"><h2>Conta</h2><div class="kv"><span>Usuário</span><b>${esc(S.perfil.nome)}</b></div><div class="kv"><span>Função</span><b>${ger ? 'Gerente / Patrão' : 'Balanceiro'}</b></div><div class="kv"><span>E-mail</span><b>${esc(S.user.email)}</b></div>
  <button class="btn sec" style="margin-top:12px" data-act="trocarSenha">Trocar minha senha</button></div>
  ${usuarios}
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
  if (el.dataset.tab) { S.tab = el.dataset.tab; ls.set('cs_tab', S.tab); render(); window.scrollTo(0, 0); if (S.tab === 'mais') carregarUsuarios().then(() => { if (S.tab === 'mais') render(); }); }
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
    else if (a === 'zap') resumoZap();
    else if (a === 'sync') { await enviarFila(); await carregar(); render(); toast(S.online ? 'Dados atualizados' : 'Sem conexão', !S.online); }
    else if (a === 'instalar' && instalar) { instalar.prompt(); instalar = null; }
    else if (a === 'novoTal') abrirTalhao('');
    else if (a === 'descartar') { S.fila = S.fila.filter(x => x.client_id !== el.dataset.id); salvaFila(); fechar(); render(); toast('Carga descartada'); }
    else if (a === 'cancelar') {
      const motivo = ($('#cMotivo').value || '').trim(); if (!motivo) return toast('Informe o motivo.', true);
      const { error } = await sb.from('cs_cargas').update({ status: 'cancelada', motivo_cancelamento: motivo }).eq('id', el.dataset.id);
      if (error) return toast(traduz(error), true);
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
  if (e.target.id === 'fTalhao') {
    e.preventDefault(); const id = e.target.dataset.id;
    const ha = String($('#tHa').value).replace(',', '.').trim();
    const row = { nome: $('#tNome').value.trim(), variedade_id: $('#tVar').value || null, area_ha: ha === '' ? null : parseFloat(ha) };
    if (!row.nome) return toast('Informe o nome.', true);
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
      S.user = null; S.perfil = null; S.cargas = []; S.talhoes = []; S.variedades = []; S.usuarios = []; S.safra = null;
      try { localStorage.removeItem('cs_cache'); localStorage.removeItem('cs_perfil'); } catch { } /* aparelho compartilhado: não deixa dados da conta */
      render();
    }
  });
  if (S.user) { S.perfil = ls.get('cs_perfil', null); const c = ls.get('cs_cache', null); if (c) { S.safra = c.safra; S.talhoes = c.talhoes; S.cargas = c.cargas; S.variedades = c.variedades || []; } render(); await carregarPerfil(); await carregar(); render(); enviarFila(); }
  else render();
}
iniciar();
