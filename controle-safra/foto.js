/* Foto da balança: lê o peso (OCR gratuito no aparelho), guarda a foto só neste aparelho e compartilha no WhatsApp */
const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
const OCR = { worker: null, carregando: null };

function carregaScript(src) {
  return new Promise((ok, falha) => {
    if (window.Tesseract) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => falha(new Error('sem internet'));
    document.head.appendChild(s);
  });
}
async function ocrWorker() {
  if (OCR.worker) return OCR.worker;
  if (!OCR.carregando) OCR.carregando = (async () => {
    await carregaScript(OCR_CDN + 'tesseract.min.js');
    const w = await Tesseract.createWorker('eng', 1, {
      workerPath: OCR_CDN + 'worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
    });
    await w.setParameters({ tessedit_char_whitelist: '0123456789.,', tessedit_pageseg_mode: '11' });
    OCR.worker = w; return w;
  })().catch(e => { OCR.carregando = null; throw e; });
  return OCR.carregando;
}
async function bitmapDe(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = URL.createObjectURL(blob); }); }
}
function desenha(bmp, max) {
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c;
}
/* cinza + contraste automático (e versão invertida, para display claro sobre fundo escuro) */
function variantes(canvas) {
  const ctx = canvas.getContext('2d'), im = ctx.getImageData(0, 0, canvas.width, canvas.height), d = im.data;
  const g = new Uint8Array(d.length / 4); let lo = 255, hi = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0; g[j] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const esc = hi > lo ? 255 / (hi - lo) : 1, out = [];
  { /* visor de LED: só pixels muito brilhantes e coloridos viram "tinta" (apaga caderno, botões e etiquetas) */
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const cx = c.getContext('2d'), o = cx.createImageData(c.width, c.height); let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const tinta = mx > 140 && (mx - mn) / mx > 0.5; if (tinta) n++;
      const v = tinta ? 0 : 255; o.data[i] = o.data[i + 1] = o.data[i + 2] = v; o.data[i + 3] = 255;
    }
    cx.putImageData(o, 0, 0); c.led = n > canvas.width * canvas.height * 0.0008 && n < canvas.width * canvas.height * 0.2; if (c.led) out.push(c);
  }
  for (const inv of [false, true]) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const cx = c.getContext('2d'), o = cx.createImageData(c.width, c.height);
    for (let j = 0, i = 0; j < g.length; j++, i += 4) { let v = (g[j] - lo) * esc; if (inv) v = 255 - v; o.data[i] = o.data[i + 1] = o.data[i + 2] = v; o.data[i + 3] = 255; }
    cx.putImageData(o, 0, 0); out.push(c);
  }
  return out;
}
/* números plausíveis de peso (1.000 a 99.999 kg) no texto lido */
function pesosNoTexto(txt) {
  const r = [];
  for (const m of String(txt).matchAll(/\d[\d.,]*\d|\d/g)) {
    let t = m[0];
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');           // 40.940 ou 40,940
    else if (/[.,]\d{1,2}$/.test(t)) t = t.replace(/[.,]\d{1,2}$/, '').replace(/[.,]/g, '');   // 40940,0
    else t = t.replace(/[.,]/g, '');
    const n = parseInt(t, 10); if (n >= 1000 && n <= 99999) r.push(n);
  }
  return r;
}
async function lerPesoFoto(blob) {
  const w = await ocrWorker(), bmp = await bitmapDe(blob), base = desenha(bmp, 1500);
  const todas = [], vars = variantes(base);
  for (const c of vars) {
    for (const modo of ['11', '6']) {      /* 11 = texto solto (acha o visor), 6 = bloco */
      await w.setParameters({ tessedit_pageseg_mode: modo });
      const { data } = await w.recognize(c);
      for (const p of data.words || []) {
        const h = p.bbox ? p.bbox.y1 - p.bbox.y0 : 1;
        for (const n of pesosNoTexto(p.text)) todas.push({ n, conf: Math.max(p.confidence, 1), h, led: !!c.led });
      }
      if (c.led && todas.some(x => x.led)) break;
    }
    if (c.led && todas.some(x => x.led)) break;   /* achou no visor de LED: não precisa olhar o resto da foto */
  }
  /* o número do visor é o maior da foto: pesa pela altura dos dígitos (caderno e etiquetas são pequenos) */
  const hmax = Math.max(1, ...todas.map(x => x.h)), votos = new Map();
  for (const x of todas) { if (x.h < hmax * 0.4) continue; votos.set(x.n, (votos.get(x.n) || 0) + x.conf * x.h * x.h); }
  const lista = [...votos.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return { valor: lista[0] || null, candidatos: lista.slice(0, 4) };
}
/* foto comprimida (~200 KB) para guardar e compartilhar */
async function comprimeFoto(blob) {
  const bmp = await bitmapDe(blob), c = desenha(bmp, 1280);
  return await new Promise(ok => c.toBlob(b => ok(b || blob), 'image/jpeg', 0.72));
}
/* armazenamento local (IndexedDB) das fotos, por viagem */
const FOTO_DB = () => new Promise((ok, falha) => {
  const rq = indexedDB.open('cs_fotos', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('f');
  rq.onsuccess = () => ok(rq.result); rq.onerror = () => falha(rq.error);
});
async function fotoSalva(id, blob) {
  try { const db = await FOTO_DB(); await new Promise((ok, f) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(blob, id); t.oncomplete = ok; t.onerror = () => f(t.error); }); return true; } catch { return false; }
}
async function fotoLe(id) {
  if (!id) return null;
  try { const db = await FOTO_DB(); return await new Promise((ok, f) => { const r = db.transaction('f').objectStore('f').get(id); r.onsuccess = () => ok(r.result || null); r.onerror = () => f(r.error); }); } catch { return null; }
}
