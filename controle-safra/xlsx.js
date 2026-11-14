/* Gerador mínimo de planilhas Excel (.xlsx), sem bibliotecas e sem internet.
   xlsxBlob([{ nome, titulo, colunas:[{t, w, tipo}], linhas:[[...]], total:true }]) -> Blob
   tipo: 'txt' | 'n0' | 'n1' | 'n2' | 'data' (data = 'AAAA-MM-DD') */
const XLSX_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function xlsxCrc(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = XLSX_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function xlsxZip(arquivos) {                                                        // zip sem compressão ("store")
  const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [nome, texto] of arquivos) {
    const nb = enc.encode(nome), db = enc.encode(texto), crc = xlsxCrc(db);
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0)]);
    partes.push(lh, nb, db);
    central.push({ nb, crc, tam: db.length, pos }); pos += lh.length + nb.length + db.length;
  }
  const ini = pos; let tamC = 0;
  for (const c of central) {
    const ch = new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c.crc), ...u32(c.tam), ...u32(c.tam), ...u16(c.nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.pos)]);
    partes.push(ch, c.nb); tamC += ch.length + c.nb.length;
  }
  partes.push(new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(tamC), ...u32(ini), ...u16(0)]));
  return new Blob(partes, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xlsxEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const xlsxCol = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const XLSX_FMT = { n0: 1, n1: 2, n2: 3, data: 4 };                                  // índices dos formatos numéricos (164..167)
function xlsxEstilo(tipo, zebra, total) {                                           // índice em cellXfs
  if (total) return { txt: 10, n0: 11, n1: 12, n2: 13, data: 10 }[tipo] ?? 10;
  const base = { txt: 2, n0: 4, n1: 6, n2: 8, data: 15 }[tipo] ?? 2; return zebra ? base + 1 : base;
}
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.0"/><numFmt numFmtId="166" formatCode="#,##0.00"/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF46697D"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF46697D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6F1E0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD7E4E8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE3D7B4"/></left><right style="thin"><color rgb="FFE3D7B4"/></right><top style="thin"><color rgb="FFE3D7B4"/></top><bottom style="thin"><color rgb="FFE3D7B4"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="166" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function xlsxSerial(d) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!m) return null; return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000); }
function xlsxPlanilha(p) {
  const cols = p.colunas, cab = p.titulo ? 3 : 1, linhas = p.linhas, nCol = cols.length;
  let xml = '', r = 0;
  if (p.titulo) { r++; xml += `<row r="${r}" ht="22" customHeight="1"><c r="A${r}" s="14" t="inlineStr"><is><t>${xlsxEsc(p.titulo)}</t></is></c></row>`; r++; xml += `<row r="${r}"/>`; }
  r++; xml += `<row r="${r}" ht="30" customHeight="1">${cols.map((c, i) => `<c r="${xlsxCol(i)}${r}" s="1" t="inlineStr"><is><t>${xlsxEsc(c.t)}</t></is></c>`).join('')}</row>`;
  const ultimo = linhas.length;
  linhas.forEach((ln, k) => {
    r++; const tot = p.total && k === ultimo - 1, zebra = k % 2 === 1;
    xml += `<row r="${r}">` + cols.map((c, i) => {
      const v = ln[i], tipo = c.tipo || 'txt', ref = xlsxCol(i) + r, st = xlsxEstilo(tipo, zebra, tot);
      if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${st}"/>`;
      if (tipo === 'data') { const n = xlsxSerial(v); return n === null ? `<c r="${ref}" s="${st}" t="inlineStr"><is><t>${xlsxEsc(v)}</t></is></c>` : `<c r="${ref}" s="${st}"><v>${n}</v></c>`; }
      if (tipo !== 'txt' && Number.isFinite(Number(v))) return `<c r="${ref}" s="${st}"><v>${Number(v)}</v></c>`;
      return `<c r="${ref}" s="${st}" t="inlineStr"><is><t>${xlsxEsc(v)}</t></is></c>`;
    }).join('') + '</row>';
  });
  const fim = Math.max(r, cab);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${cab}" topLeftCell="A${cab + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`).join('')}</cols><sheetData>${xml}</sheetData>${linhas.length ? `<autoFilter ref="A${cab}:${xlsxCol(nCol - 1)}${fim - (p.total ? 1 : 0)}"/>` : ''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`;
}
function xlsxBlob(planilhas) {
  const nomes = planilhas.map((p, i) => xlsxEsc(String(p.nome || 'Planilha' + (i + 1)).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)));
  const arquivos = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${planilhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${planilhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', XLSX_STYLES],
    ...planilhas.map((p, i) => [`xl/worksheets/sheet${i + 1}.xml`, xlsxPlanilha(p)])
  ];
  return xlsxZip(arquivos);
}
function baixarArquivo(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
if (typeof module !== 'undefined') module.exports = { xlsxBlob, xlsxZip };
