/* Balança: peso ao vivo pela porta serial (Web Serial API — Chrome/Edge no computador).
   O visor envia o peso o tempo todo; aqui lemos, mostramos ao vivo e o botão "Registrar" copia o valor estável para a viagem. */
const BAL = { port: null, reader: null, ativo: false, peso: null, estavel: false, ultimo: 0, janela: [], raw: [], buf: '', erro: '' };
const BAL_PADRAO = { baud: 9600, dados: 8, paridade: 'none', stop: 1, tol: 20 };
const balSuportada = () => typeof navigator !== 'undefined' && 'serial' in navigator;
function balCfg() { try { return { ...BAL_PADRAO, ...JSON.parse(localStorage.getItem('cs_bal') || '{}') }; } catch { return { ...BAL_PADRAO }; } }
function balSalvaCfg(c) { try { localStorage.setItem('cs_bal', JSON.stringify(c)); } catch { } }

/* Lê um quadro de texto da balança e devolve o peso BRUTO em kg (ou null). Aceita os formatos mais comuns. */
function balNum(x) {                                                            // "40.940,5" | "40,940.5" | "26,9" | "26900.5"
  x = String(x).trim();
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x)) return parseFloat(x.replace(/\./g, '').replace(',', '.'));
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) return parseFloat(x.replace(/,/g, ''));
  return parseFloat(x.replace(',', '.'));
}
function balParse(t) {
  const s = String(t).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/^(T|N|TARA|TARE|PT|NET|LIQ)\b/i.test(s)) return null;                 // linha de tara ou líquido
  let m = s.match(/([-+]?\d[\d.,]*)\s*(kg|g|t|lb)\b/i);                 // "26900 kg G", "ST,GS,+026900 kg"
  if (m) {
    let v = balNum(m[1]); const u = m[2].toLowerCase();
    if (u === 'g') v /= 1000; else if (u === 't') v *= 1000; else if (u === 'lb') v *= 0.45359237;
    return v < 0 ? 0 : Math.round(v * 10) / 10;
  }
  m = s.match(/(\d{6})(\d{6})(?!\d)/);                                         // Toledo contínuo: peso(6) + tara(6)
  if (m) return parseInt(m[1], 10);
  m = s.match(/[-+]?\d[\d.,]{2,}/);                                           // número solto
  if (m) { const v = balNum(m[0]); return Number.isFinite(v) ? (v < 0 ? 0 : v) : null; }
  return null;
}

function balLeitura(p) {
  const agora = Date.now(); BAL.peso = p; BAL.ultimo = agora;
  BAL.janela.push({ t: agora, p }); BAL.janela = BAL.janela.filter(x => agora - x.t <= 1500);
  const ps = BAL.janela.map(x => x.p), tol = balCfg().tol;
  BAL.estavel = BAL.janela.length >= 5 && Math.max(...ps) - Math.min(...ps) <= tol && p >= 500;
  balAtualiza();
}
function balProcessa(texto) {
  BAL.buf += texto;
  const partes = BAL.buf.split(/[\r\n\x03]+/); BAL.buf = partes.pop();
  if (BAL.buf.length > 400) BAL.buf = '';
  for (const q of partes) {
    if (!q.replace(/\x02/g, '').trim()) continue;
    BAL.raw.push(q); if (BAL.raw.length > 12) BAL.raw.shift();
    const quadros = q.split('\x02').filter(x => x.trim());
    for (const f of quadros) { const p = balParse(f); if (p !== null) balLeitura(p); }
  }
}
async function balConectar(pedir) {
  if (!balSuportada()) return;
  const cfg = balCfg(); BAL.erro = '';
  try {
    let port;
    if (pedir) port = await navigator.serial.requestPort();
    else { const ps = await navigator.serial.getPorts(); port = ps[0]; }
    if (!port) return;
    await port.open({ baudRate: Number(cfg.baud), dataBits: Number(cfg.dados), stopBits: Number(cfg.stop), parity: cfg.paridade });
    BAL.port = port; BAL.ativo = true; BAL.janela = []; BAL.peso = null; BAL.estavel = false; BAL.buf = '';
    balAtualiza(true);
    balLoop(port);
  } catch (e) {
    BAL.ativo = false;
    if (e && e.name === 'NotFoundError') return;                                // usuário fechou a janela de escolha
    BAL.erro = /in use|busy|already|access denied|failed to open/i.test(String(e && e.message)) ? 'A porta está em uso por outro programa. Feche o outro sistema que lê a balança.' : 'Não foi possível abrir a porta: ' + (e && e.message ? e.message : e);
    balAtualiza(true);
  }
}
async function balLoop(port) {
  const dec = new TextDecoder('latin1');
  try {
    while (port.readable && BAL.ativo) {
      BAL.reader = port.readable.getReader();
      try {
        for (;;) { const { value, done } = await BAL.reader.read(); if (done) break; if (value) balProcessa(dec.decode(value, { stream: true })); }
      } finally { BAL.reader.releaseLock(); }
    }
  } catch (e) { if (BAL.ativo) BAL.erro = 'Conexão com a balança interrompida.'; }
  BAL.ativo = false; BAL.estavel = false;
  try { await port.close(); } catch { }
  balAtualiza(true);
}
async function balDesconectar() {
  BAL.ativo = false;
  try { if (BAL.reader) await BAL.reader.cancel(); } catch { }
  try { if (BAL.port) await BAL.port.close(); } catch { }
  BAL.peso = null; BAL.estavel = false; balAtualiza(true);
}
async function balAuto() {                                                       // reconecta sozinho na porta já autorizada
  if (!balSuportada()) return;
  try {
    const ps = await navigator.serial.getPorts();
    if (ps.length) balConectar(false);
    navigator.serial.addEventListener('disconnect', () => { BAL.ativo = false; BAL.erro = 'A balança foi desconectada.'; balAtualiza(true); });
    navigator.serial.addEventListener('connect', () => { if (!BAL.ativo) balConectar(false); });
  } catch { }
}

/* ----- tela ----- */
const balKg = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
function balEstado() {
  if (!BAL.ativo) return ['desc', 'DESCONECTADA'];
  if (BAL.peso === null || Date.now() - BAL.ultimo > 3000) return ['desc', 'SEM SINAL'];
  if (BAL.peso < 500) return ['vazio', 'SEM CAMINHÃO'];
  return BAL.estavel ? ['ok', 'PESO ESTÁVEL'] : ['pesa', 'PESANDO…'];
}
function balCardHtml() {
  if (!balSuportada()) return typeof matchMedia === 'function' && matchMedia('(min-width:900px)').matches
    ? '<div class="card bal-dica rise">Para ler o peso direto da balança, abra o app no <b>Chrome</b> ou <b>Edge</b> do computador.</div>' : '';
  return `<div class="card bal rise" id="balCard">
    <div class="bal-top"><div class="bal-t"><span>Balança</span><b id="balPeso">—</b><em>kg</em></div><span class="bal-selo desc" id="balSelo">DESCONECTADA</span></div>
    <div class="bal-msg" id="balMsg"></div>
    <div class="acoes" id="balBtns"><button type="button" class="btn-acao vd" id="balBruto" disabled><span class="ic"><svg viewBox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg></span><span class="tx"><b>Registrar peso bruto</b><small>copia para a viagem</small></span></button>
    <button type="button" class="btn-acao am" id="balTara" disabled><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 4v12"/><path d="M6 16h12"/><path d="M8 20h8"/></svg></span><span class="tx"><b>Usar como tara</b><small>caminhão vazio</small></span></button></div>
    <div class="bal-rod"><button type="button" class="link-sm" id="balCon">Conectar balança</button><button type="button" class="link-sm" id="balAju">Ajustes e diagnóstico</button></div></div>`;
}
function balAtualiza(tudo) {
  const el = document.getElementById('balPeso'); if (!el) return;
  const [cl, tx] = balEstado(), selo = document.getElementById('balSelo');
  el.textContent = BAL.ativo && BAL.peso !== null ? balKg(BAL.peso) : '—';
  selo.className = 'bal-selo ' + cl; selo.textContent = tx;
  const ok = BAL.ativo && BAL.peso !== null && BAL.peso >= 500;
  document.getElementById('balBruto').disabled = !ok; document.getElementById('balTara').disabled = !ok;
  document.getElementById('balBruto').classList.toggle('pronto', cl === 'ok');
  const con = document.getElementById('balCon'); con.textContent = BAL.ativo ? 'Desconectar' : 'Conectar balança';
  document.getElementById('balMsg').textContent = BAL.erro || '';
  document.getElementById('balCard').classList.toggle('ligada', BAL.ativo);
  if (tudo) { const c = document.getElementById('balCard'); c.dataset.t = Date.now(); }
}
function balRegistrar(campo, rotulo) {
  if (!BAL.ativo || BAL.peso === null) return;
  if (!BAL.estavel && !confirm('O peso ainda está oscilando. Registrar mesmo assim?')) return;
  const inp = document.getElementById(campo); if (!inp) return;
  const v = Math.round(BAL.peso);
  inp.value = v.toLocaleString('pt-BR').replace(/,/g, '.'); inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.classList.remove('conferir'); inp.classList.add('da-balanca'); setTimeout(() => inp.classList.remove('da-balanca'), 1800);
  if (typeof toast === 'function') toast(rotulo + ' registrado: ' + balKg(v) + ' kg');
}
function balBind() {
  const g = id => document.getElementById(id); if (!g('balCard')) return;
  g('balCon').addEventListener('click', () => BAL.ativo ? balDesconectar() : balConectar(true));
  g('balBruto').addEventListener('click', () => balRegistrar('cBruto', 'Peso bruto'));
  g('balTara').addEventListener('click', () => balRegistrar('cTara', 'Tara'));
  g('balAju').addEventListener('click', balAjustes);
  balAtualiza();
}
function balAjustes() {
  const c = balCfg(), opt = (v, a) => `<option value="${v}" ${String(a) === String(v) ? 'selected' : ''}>${v}</option>`;
  const hex = s => [...s].map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  sheet(`<h2>Balança</h2><form id="fBal">
    <div class="row2"><div class="field"><label>Velocidade (baud)</label><select id="bBaud">${[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(v => opt(v, c.baud)).join('')}</select></div>
    <div class="field"><label>Bits de dados</label><select id="bDados">${[7, 8].map(v => opt(v, c.dados)).join('')}</select></div></div>
    <div class="row2"><div class="field"><label>Paridade</label><select id="bPar">${[['none', 'Nenhuma'], ['even', 'Par'], ['odd', 'Ímpar']].map(([v, n]) => `<option value="${v}" ${c.paridade === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label>Bits de parada</label><select id="bStop">${[1, 2].map(v => opt(v, c.stop)).join('')}</select></div></div>
    <div class="field"><label>Tolerância para "estável" (kg)</label><input id="bTol" inputmode="numeric" value="${c.tol}"><div class="hint">O peso é considerado estável quando varia menos que isso por 1,5 segundo.</div></div>
    <button class="btn" type="submit">Salvar ajustes</button></form>
    <h3 style="margin:18px 0 6px">O que a balança está enviando</h3>
    <div class="hint" style="margin:0 0 6px">Se o peso não aparecer, copie estas linhas e envie para o suporte.</div>
    <pre class="bal-raw" id="balRaw">${BAL.raw.length ? BAL.raw.map(q => esc(q.replace(/[\x00-\x1f]/g, '·')) + '   [' + hex(q) + ']').join('\n') : 'Nada recebido ainda. Conecte a balança e coloque peso.'}</pre>
    <button class="btn sec" style="margin-top:10px" type="button" id="balCopia">Copiar amostra</button>
    <button class="btn sec" style="margin-top:10px" data-act="fechar" type="button">Fechar</button>`);
  const f = document.getElementById('fBal');
  f.addEventListener('submit', e => {
    e.preventDefault();
    balSalvaCfg({ baud: Number(f.bBaud.value), dados: Number(f.bDados.value), paridade: f.bPar.value, stop: Number(f.bStop.value), tol: Math.max(1, parseInt(f.bTol.value, 10) || 20) });
    if (typeof toast === 'function') toast(BAL.ativo ? 'Salvo. Desconecte e conecte de novo a balança.' : 'Ajustes salvos');
    fechar();
  });
  document.getElementById('balCopia').addEventListener('click', () => { try { navigator.clipboard.writeText(document.getElementById('balRaw').textContent); toast('Amostra copiada'); } catch { toast('Não foi possível copiar', true); } });
}
if (typeof document !== 'undefined') setInterval(() => { if (document.getElementById('balPeso')) balAtualiza(); }, 1000);
if (typeof module !== 'undefined') module.exports = { balParse };
