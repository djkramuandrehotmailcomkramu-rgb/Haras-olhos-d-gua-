import type { jsPDF } from 'jspdf';
import type { PlanoCampo } from '../store/dados';
import { CORES_VARIEDADE, compararComMeta, conferirAreas } from '../geo/campo';
import { formatarHa } from '../geo/unidades';
import { formatarNumeroBR, formatarPercentual } from '../geo/numero';
import type { Talhao } from '../store/dados';
import type { Coord } from '../geo/medidas';

type NomeTalhao = (id: string) => string;

const hexParaRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clarear = (rgb: [number, number, number], k: number): [number, number, number] => [0, 1, 2].map((i) => Math.round(rgb[i] + (255 - rgb[i]) * k)) as [number, number, number];

// A fonte padrão do PDF (Helvetica) aceita acentos, mas não símbolos como "·" ou "≈".
const limpo = (s: string) => s.replace(/[·•]/g, '-').replace(/≈/g, '~').replace(/[^\x20-\x7E -ÿ]/g, '');
const ha = (m2: number) => formatarHa(m2);
const grau = (v: number) => v.toFixed(6).replace('.', ',');

/** Projeção plana local, em metros, em torno de um ponto. */
function projetor(ref: Coord) {
  const kx = Math.cos((ref[1] * Math.PI) / 180) * 111319.49;
  return (c: Coord): [number, number] => [(c[0] - ref[0]) * kx, (c[1] - ref[1]) * 111319.49];
}

export type DadosPdf = { plano: PlanoCampo; nomeTalhao: NomeTalhao; fazenda?: string; talhoes?: Talhao[] };

/** Monta o PDF do plano de campo de sementes (A4 retrato). */
export async function montarPdfCampo({ plano, nomeTalhao, fazenda, talhoes }: DadosPdf): Promise<jsPDF> {
  const { jsPDF: PDF } = await import('jspdf');
  const doc = new PDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210, M = 14;
  const verde: [number, number, number] = [31, 122, 62];
  const cinza: [number, number, number] = [95, 107, 97];
  const preto: [number, number, number] = [19, 32, 26];

  const variedades = plano.variedades;
  const corDe = (v: string): [number, number, number] => {
    const i = variedades.indexOf(v);
    return hexParaRgb(CORES_VARIEDADE[(i < 0 ? CORES_VARIEDADE.length - 1 : i) % CORES_VARIEDADE.length]);
  };

  let pagina = 1;
  const rodape = () => {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...cinza);
    doc.text(limpo('GPSThomas - Campo de sementes. Medidas feitas com GPS de celular têm erro de 3 a 10 m; confira em campo.'), M, 288);
    doc.text(`Página ${pagina}`, W - M, 288, { align: 'right' });
  };
  const novaPagina = () => { rodape(); doc.addPage(); pagina += 1; };

  // ---------- cabeçalho ----------
  doc.setFillColor(...verde).rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(20).text('GPSThomas', M, 12);
  doc.setFont('helvetica', 'normal').setFontSize(10).text('Plano de campo de sementes', M, 19);
  doc.setFontSize(9).text(new Date(plano.criadoEm).toLocaleDateString('pt-BR'), W - M, 12, { align: 'right' });
  doc.text(limpo(fazenda ?? ''), W - M, 19, { align: 'right' });

  doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(16).text(limpo(plano.nome), M, 36);
  const totalHa = plano.partes.reduce((s, p) => s + p.areaM2, 0);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...cinza).text(
    limpo(`${plano.partes.length} partes - ${plano.divisas.length} divisas - ${plano.bandeiras.length} bandeirinhas - ${ha(totalHa)} no total${plano.corredorM ? ` - corredor de ${plano.corredorM} m` : ''}`),
    M, 42,
  );

  // ---------- mapa vetorial ----------
  const caixa = { x: M, y: 48, w: W - 2 * M, h: 138 };
  doc.setDrawColor(200, 208, 202).setFillColor(244, 247, 243).roundedRect(caixa.x, caixa.y, caixa.w, caixa.h, 2, 2, 'FD');

  const todos: Coord[] = [...plano.partes.flatMap((p) => p.pedacos.flat()), ...plano.bandeiras.map((b) => b.coord)];
  if (todos.length) {
    const ref = todos[0];
    const proj = projetor(ref);
    const xy = todos.map(proj);
    const minX = Math.min(...xy.map((p) => p[0])), maxX = Math.max(...xy.map((p) => p[0]));
    const minY = Math.min(...xy.map((p) => p[1])), maxY = Math.max(...xy.map((p) => p[1]));
    const pad = 9;
    const esc = Math.min((caixa.w - 2 * pad) / Math.max(1, maxX - minX), (caixa.h - 2 * pad) / Math.max(1, maxY - minY)); // mm por metro
    const offX = caixa.x + (caixa.w - (maxX - minX) * esc) / 2;
    const offY = caixa.y + (caixa.h - (maxY - minY) * esc) / 2;
    const paraPdf = (c: Coord): [number, number] => {
      const p = proj(c);
      return [offX + (p[0] - minX) * esc, offY + (maxY - p[1]) * esc];
    };

    plano.partes.forEach((p) => {
      const rgb = p.variedade ? corDe(p.variedade) : ([143, 163, 154] as [number, number, number]);
      doc.setFillColor(...clarear(rgb, 0.45)).setDrawColor(...rgb).setLineWidth(0.5);
      p.pedacos.forEach((anel) => {
        const pts = anel.map(paraPdf);
        if (pts.length < 3) return;
        const rel = pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]);
        doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
      });
    });
    // rótulos das partes
    plano.partes.forEach((p) => {
      const pts = p.pedacos.flat().map(paraPdf);
      if (!pts.length) return;
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(7.5).text(limpo(p.variedade || `Parte ${p.indice + 1}`), cx, cy - 0.5, { align: 'center', maxWidth: 40 });
      doc.setFont('helvetica', 'normal').setFontSize(7).text(ha(p.areaM2), cx, cy + 3, { align: 'center' });
    });
    // bandeirinhas numeradas
    plano.bandeiras.forEach((b, i) => {
      const [x, y] = paraPdf(b.coord);
      doc.setFillColor(229, 72, 77).setDrawColor(255, 255, 255).setLineWidth(0.3).circle(x, y, 1.9, 'FD');
      doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(5.5).text(String(i + 1), x, y + 0.7, { align: 'center' });
    });

    // seta do norte
    const nx = caixa.x + caixa.w - 9, ny = caixa.y + 14;
    doc.setFillColor(...preto).triangle(nx, ny - 8, nx - 3, ny, nx + 3, ny, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(9).text('N', nx, ny + 5, { align: 'center' });

    // barra de escala (valor "redondo")
    const candidatos = [10, 20, 50, 100, 200, 250, 500, 1000, 2000];
    const alvoM = (caixa.w * 0.25) / esc;
    const escolha = [...candidatos].reverse().find((c) => c <= alvoM) ?? candidatos[0];
    const largura = escolha * esc;
    const sx = caixa.x + 6, sy = caixa.y + caixa.h - 7;
    doc.setDrawColor(...preto).setLineWidth(0.6).line(sx, sy, sx + largura, sy).line(sx, sy - 1.6, sx, sy + 1.6).line(sx + largura, sy - 1.6, sx + largura, sy + 1.6);
    doc.setTextColor(...preto).setFont('helvetica', 'normal').setFontSize(8).text(escolha >= 1000 ? `${escolha / 1000} km` : `${escolha} m`, sx + largura / 2, sy - 2.2, { align: 'center' });
  } else {
    doc.setTextColor(...cinza).setFontSize(10).text('Sem partes para desenhar.', caixa.x + caixa.w / 2, caixa.y + caixa.h / 2, { align: 'center' });
  }

  // ---------- legenda de variedades ----------
  let y = caixa.y + caixa.h + 8;
  doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(11).text('Variedades', M, y);
  y += 6;
  const lista = variedades.length ? variedades : ['(sem variedade definida)'];
  lista.forEach((v, i) => {
    const col = i % 2, linha = Math.floor(i / 2);
    const x = M + col * 92, yy = y + linha * 6.5;
    doc.setFillColor(...(variedades.length ? corDe(v) : ([143, 163, 154] as [number, number, number]))).roundedRect(x, yy - 3.4, 4, 4, 0.8, 0.8, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'normal').setFontSize(9.5).text(limpo(v), x + 6, yy);
  });
  y += Math.ceil(lista.length / 2) * 6.5 + 2;

  // ---------- tabela de partes ----------
  const cabecalhoTabela = (yy: number) => {
    doc.setFillColor(...clarear(verde, 0.82)).rect(M, yy - 4.5, W - 2 * M, 7, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(9);
    doc.text('Talhão', M + 2, yy); doc.text('Parte', M + 62, yy); doc.text('Variedade', M + 80, yy); doc.text('Área', W - M - 2, yy, { align: 'right' });
  };
  if (y > 240) { novaPagina(); y = 20; }
  doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(11).text('Partes', M, y);
  y += 7;
  cabecalhoTabela(y);
  y += 7;
  plano.partes.forEach((p, i) => {
    if (y > 276) { novaPagina(); y = 22; cabecalhoTabela(y); y += 7; }
    if (i % 2 === 1) doc.setFillColor(246, 248, 246).rect(M, y - 4.5, W - 2 * M, 6.5, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'normal').setFontSize(9);
    doc.text(limpo(nomeTalhao(p.talhaoId)), M + 2, y, { maxWidth: 58 });
    doc.text(String(p.indice + 1), M + 62, y);
    doc.text(limpo(p.variedade || '-'), M + 80, y, { maxWidth: 70 });
    doc.text(ha(p.areaM2), W - M - 2, y, { align: 'right' });
    y += 6.5;
  });
  doc.setFont('helvetica', 'bold').text('Total', M + 2, y + 1).text(ha(totalHa), W - M - 2, y + 1, { align: 'right' });
  y += 10;

  // ---------- total por variedade ----------
  const tot = new Map<string, { m2: number; n: number }>();
  plano.partes.forEach((p) => { const k = p.variedade || '(sem variedade)'; const a = tot.get(k) ?? { m2: 0, n: 0 }; tot.set(k, { m2: a.m2 + p.areaM2, n: a.n + 1 }); });
  if (y > 250) { novaPagina(); y = 22; }
  doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(11).text('Total por variedade', M, y);
  y += 7;
  [...tot.entries()].forEach(([nome, v]) => {
    if (y > 278) { novaPagina(); y = 22; }
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...preto).text(limpo(`${nome}${v.n > 1 ? ` (${v.n} partes)` : ''}`), M + 2, y);
    const c = compararComMeta(v.m2, plano.metaHa);
    if (c.selo !== 'sem-meta') {
      doc.setTextColor(...(c.selo === 'ok' ? verde : ([180, 110, 0] as [number, number, number])));
      doc.text(c.selo === 'ok' ? 'na meta' : `${c.diffHa > 0 ? '+' : ''}${c.diffHa.toFixed(1).replace('.', ',')} ha`, W - M - 34, y, { align: 'right' });
      doc.setTextColor(...preto);
    }
    doc.text(ha(v.m2), W - M - 2, y, { align: 'right' });
    y += 6;
  });
  if (plano.metaHa) {
    doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...cinza).text(limpo(`Meta por variedade: ${formatarNumeroBR(plano.metaHa)} ha (tolerância de 0,3 ha ou 2%)`), M + 2, y + 1);
    y += 7;
  }

  // ---------- conferência de áreas ----------
  if (talhoes && talhoes.length) {
    if (y > 250) { novaPagina(); y = 22; }
    y += 4;
    doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(11).text('Conferência de áreas', M, y);
    y += 7;
    conferirAreas(plano, talhoes).forEach((c) => {
      if (y > 278) { novaPagina(); y = 22; }
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...preto).text(limpo(nomeTalhao(c.talhaoId)), M + 2, y);
      doc.setTextColor(...cinza).setFontSize(9).text(limpo(`partes ${ha(c.partesM2)} de ${ha(c.medidaM2)} medidos${c.corredorEsperadoM2 > 1 ? ` (corredor ${ha(c.corredorEsperadoM2)})` : ''}`), 70, y);
      doc.setTextColor(...(c.alerta ? ([180, 110, 0] as [number, number, number]) : verde)).text(formatarPercentual(c.diffPercentual), W - M - 2, y, { align: 'right' });
      y += 6;
    });
  }

  // ---------- bandeirinhas ----------
  novaPagina();
  y = 22;
  doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(13).text('Bandeirinhas (pontos das divisas)', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...cinza).text('Toque no link para abrir o ponto no Google Maps. Coordenadas em graus decimais (WGS 84).', M, y);
  y += 8;
  const cab2 = (yy: number) => {
    doc.setFillColor(...clarear(verde, 0.82)).rect(M, yy - 4.5, W - 2 * M, 7, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'bold').setFontSize(9);
    doc.text('Nº', M + 2, yy); doc.text('Ponto', M + 12, yy); doc.text('Latitude', M + 104, yy); doc.text('Longitude', M + 128, yy); doc.text('Mapa', W - M - 2, yy, { align: 'right' });
  };
  cab2(y);
  y += 7;
  plano.bandeiras.forEach((b, i) => {
    if (y > 278) { novaPagina(); y = 22; cab2(y); y += 7; }
    if (i % 2 === 1) doc.setFillColor(246, 248, 246).rect(M, y - 4.5, W - 2 * M, 6.5, 'F');
    doc.setTextColor(...preto).setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text(String(i + 1), M + 2, y);
    doc.text(limpo(b.rotulo), M + 12, y, { maxWidth: 90 });
    doc.text(grau(b.coord[1]), M + 104, y);
    doc.text(grau(b.coord[0]), M + 128, y);
    doc.setTextColor(31, 90, 200);
    doc.textWithLink('abrir', W - M - 2, y, { url: `https://www.google.com/maps?q=${b.coord[1]},${b.coord[0]}`, align: 'right' } as any);
    y += 6.5;
  });
  rodape();
  return doc;
}

export const nomeArquivoPdf = (nome: string) =>
  `${nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'campo-de-sementes'}.pdf`;

/** Gera o PDF e baixa (web) ou devolve os bytes (para compartilhar no app nativo). */
export async function baixarPdfCampo(dados: DadosPdf): Promise<void> {
  const doc = await montarPdfCampo(dados);
  doc.save(nomeArquivoPdf(dados.plano.nome));
}
