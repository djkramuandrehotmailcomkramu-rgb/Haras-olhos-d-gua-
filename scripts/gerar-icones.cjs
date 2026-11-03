// Gera public/icon-192.png e icon-512.png sem dependências (zlib + CRC manual). Roda em `prebuild`.
const zlib = require('zlib');
const fs = require('fs');
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, px) {
  const raw = Buffer.alloc((w * 4 + 1) * w);
  for (let y = 0; y < w; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(w, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// geometria no espaço 0..1: fundo navy; gota ciano (círculo + triângulo); barra verde-limão
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const NAVY = hex('#0B1B33'), CIA = hex('#22D3EE'), LIM = hex('#7BE04A');
function cor(x, y) {
  const rr = 0.22; // cantos arredondados
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - rr), 0), dy = Math.max(Math.abs(y - 0.5) - (0.5 - rr), 0);
  if (dx * dx + dy * dy > rr * rr) return null;
  if (y > 0.795 && y < 0.83 && x > 0.26 && x < 0.74) return LIM;
  const cx = 0.5, cy = 0.55, r = 0.2;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return CIA;
  const topo = 0.18; // ponta da gota
  if (y >= topo && y <= cy) { const t = (y - topo) / (cy - topo); if (Math.abs(x - cx) <= r * t * 0.97) return CIA; }
  return NAVY;
}
for (const s of [192, 512]) {
  const px = Buffer.alloc(s * s * 4), SS = 3;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
      const c = cor((x + (i + 0.5) / SS) / s, (y + (j + 0.5) / SS) / s);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const o = (y * s + x) * 4, n = SS * SS;
    px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = Math.round((255 * a) / n);
  }
  fs.writeFileSync(`public/icon-${s}.png`, png(s, px));
}
console.log('ícones gerados');
