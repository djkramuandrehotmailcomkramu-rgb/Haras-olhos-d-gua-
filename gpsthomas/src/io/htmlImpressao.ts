import { Platform } from 'react-native';
import type { DadosPdf } from './pdfCampo';
import { CORES_VARIEDADE, compararComMeta, conferirAreas, textoOrigens, totaisPorVariedade } from '../geo/campo';
import { formatarHa } from '../geo/unidades';
import { formatarNumeroBR, formatarPercentual } from '../geo/numero';
import type { Coord } from '../geo/medidas';

/** Escapa texto do usuário (nomes de talhão, variedades…) para HTML. */
export const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ha = (m2: number) => formatarHa(m2);
const grau = (v: number) => v.toFixed(6).replace('.', ',');
const cinzaVar = '#8FA39A';

function projetor(ref: Coord) {
  const kx = Math.cos((ref[1] * Math.PI) / 180) * 111319.49;
  return (c: Coord): [number, number] => [(c[0] - ref[0]) * kx, (c[1] - ref[1]) * 111319.49];
}

/** Estilo do documento de impressão (tudo escopado em #gt-impressao). */
export const CSS_IMPRESSAO = `
@page{size:A4;margin:12mm}
#gt-impressao{display:none;font:12px/1.4 Helvetica,Arial,sans-serif;color:#13201A;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#gt-impressao *{box-sizing:border-box}
#gt-impressao .topo{background:#5B4FE0;color:#fff;padding:10px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:flex-end}
#gt-impressao .topo b{font-size:20px}#gt-impressao .topo small{display:block;font-size:11px;opacity:.9}#gt-impressao .topo .dir{text-align:right;font-size:11px}
#gt-impressao h1{font-size:18px;margin:12px 0 2px}#gt-impressao h2{font-size:13px;margin:14px 0 6px}
#gt-impressao .res{color:#5F6B61;font-size:11px;margin:0 0 8px}
#gt-impressao svg{width:100%;height:auto;display:block;border:1px solid #C8D0CA;border-radius:6px;background:#F4F7F3}
#gt-impressao table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px}
#gt-impressao th{background:#E4E1FA;text-align:left;padding:4px 6px}#gt-impressao td{padding:3px 6px}
#gt-impressao tr:nth-child(even) td{background:#F6F8F6}#gt-impressao tr{break-inside:avoid}
#gt-impressao .d{text-align:right;white-space:nowrap}
#gt-impressao .leg{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:11px}#gt-impressao .leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
#gt-impressao .ok{color:#1E8E4E}#gt-impressao .at{color:#B46E00}
#gt-impressao a{color:#1F5AC8;text-decoration:none}
#gt-impressao .pag{break-before:page}
#gt-impressao .rod{color:#5F6B61;font-size:10px;margin-top:10px;border-top:1px solid #C8D0CA;padding-top:4px}
`;

/** Regras que, ao imprimir, escondem o aplicativo e mostram só o plano. */
const CSS_SO_PLANO = `@media print{html,body{height:auto!important;overflow:visible!important;background:#fff!important}body>*:not(#gt-impressao){display:none!important}#gt-impressao{display:block!important}}`;

function svgMapa(dados: DadosPdf): string {
  const { plano } = dados;
  const W = 700, H = 440, pad = 26;
  const todos: Coord[] = [...plano.partes.flatMap((p) => p.pedacos.flat()), ...plano.bandeiras.map((b) => b.coord)];
  if (!todos.length) return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#5F6B61">Sem partes para desenhar.</text></svg>`;
  const proj = projetor(todos[0]);
  const xy = todos.map(proj);
  const minX = Math.min(...xy.map((p) => p[0])), maxX = Math.max(...xy.map((p) => p[0]));
  const minY = Math.min(...xy.map((p) => p[1])), maxY = Math.max(...xy.map((p) => p[1]));
  const esc1 = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
  const offX = (W - (maxX - minX) * esc1) / 2, offY = (H - (maxY - minY) * esc1) / 2;
  const pt = (c: Coord): [number, number] => { const p = proj(c); return [offX + (p[0] - minX) * esc1, offY + (maxY - p[1]) * esc1]; };
  const f = (n: number) => n.toFixed(1);
  const variedades = plano.variedades;
  const corDe = (v: string) => { const i = variedades.indexOf(v); return v ? CORES_VARIEDADE[(i < 0 ? CORES_VARIEDADE.length - 1 : i) % CORES_VARIEDADE.length] : cinzaVar; };

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa do campo de sementes" font-family="Helvetica,Arial,sans-serif">`;
  plano.partes.forEach((p) => {
    const cor = corDe(p.variedade);
    p.pedacos.forEach((anel) => { if (anel.length >= 3) s += `<polygon points="${anel.map((c) => pt(c).map(f).join(',')).join(' ')}" fill="${cor}" fill-opacity=".45" stroke="${cor}" stroke-width="1.4" stroke-linejoin="round"/>`; });
  });
  plano.partes.forEach((p) => {
    const pts = p.pedacos.flat().map(pt);
    if (!pts.length) return;
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    s += `<text x="${f(cx)}" y="${f(cy - 1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#13201A">${esc(p.variedade || `Parte ${p.indice + 1}`)}</text>`;
    s += `<text x="${f(cx)}" y="${f(cy + 11)}" text-anchor="middle" font-size="9.5" fill="#13201A">${esc(ha(p.areaM2))}</text>`;
  });
  const ab = plano.junto?.linhaAB;
  if (ab) {
    const a = pt(ab.a), b = pt(ab.b);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const k = 4000 / len;
    s += `<line x1="${f(a[0] - dx * k)}" y1="${f(a[1] - dy * k)}" x2="${f(a[0] + dx * k)}" y2="${f(a[1] + dy * k)}" stroke="#D99A00" stroke-width="1.6" stroke-dasharray="7 5"/>`;
    ([['A', a], ['B', b]] as [string, [number, number]][]).forEach(([l, q]) => {
      if (q[0] < 8 || q[0] > W - 8 || q[1] < 8 || q[1] > H - 8) return;
      s += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="9" fill="#F2B73D" stroke="#fff" stroke-width="1.5"/><text x="${f(q[0])}" y="${f(q[1] + 3.5)}" text-anchor="middle" font-size="10" font-weight="700" fill="#2B1D00">${l}</text>`;
    });
  }
  plano.bandeiras.forEach((b, i) => {
    const q = pt(b.coord);
    s += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="7" fill="#E5484D" stroke="#fff" stroke-width="1.2"/><text x="${f(q[0])}" y="${f(q[1] + 3)}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">${i + 1}</text>`;
  });
  // seta do norte
  s += `<polygon points="${W - 28},14 ${W - 34},34 ${W - 22},34" fill="#13201A"/><text x="${W - 28}" y="48" text-anchor="middle" font-size="11" font-weight="700" fill="#13201A">N</text>`;
  // barra de escala
  const cand = [10, 20, 50, 100, 200, 250, 500, 1000, 2000];
  const alvo = (W * 0.25) / esc1;
  const m = [...cand].reverse().find((c) => c <= alvo) ?? cand[0];
  const l = m * esc1, sx = 14, sy = H - 16;
  s += `<path d="M${sx},${sy - 5} V${sy + 5} M${sx},${sy} H${f(sx + l)} M${f(sx + l)},${sy - 5} V${sy + 5}" stroke="#13201A" stroke-width="1.6" fill="none"/><text x="${f(sx + l / 2)}" y="${sy - 8}" text-anchor="middle" font-size="10" fill="#13201A">${m >= 1000 ? `${m / 1000} km` : `${m} m`}</text>`;
  return s + '</svg>';
}

/** Monta o conteúdo do plano para impressão (HTML + CSS), com o mesmo conteúdo do PDF. */
export function montarHtmlPlano(dados: DadosPdf, agora: Date = new Date()): { css: string; corpo: string } {
  const { plano, nomeTalhao, fazenda, talhoes } = dados;
  const totalM2 = plano.partes.reduce((s, p) => s + p.areaM2, 0);
  const variedades = plano.variedades;
  const corDe = (v: string) => { const i = variedades.indexOf(v); return v ? CORES_VARIEDADE[(i < 0 ? CORES_VARIEDADE.length - 1 : i) % CORES_VARIEDADE.length] : cinzaVar; };
  const junto = plano.junto;
  const resumo = `${plano.partes.length} partes · ${plano.divisas.length} divisas · ${plano.bandeiras.length} bandeirinhas · ${ha(totalM2)} no total${plano.corredorM ? ` · corredor de ${plano.corredorM} m` : ''}${junto ? ` · talhões juntos, partes de ${formatarNumeroBR(junto.haPorParte)} ha${junto.linhaAB && junto.usarLinhaAB ? `, faixas paralelas ao rastro ${junto.linhaAB.nome}` : ''}` : ''}`;

  const legenda = (variedades.length ? variedades : ['(sem variedade definida)']).map((v) => `<span><i style="background:${variedades.length ? corDe(v) : cinzaVar}"></i>${esc(v)}</span>`).join('');
  const linhasPartes = plano.partes.map((p) => `<tr><td>${esc(p.origens?.length ? textoOrigens(p, nomeTalhao) : nomeTalhao(p.talhaoId))}</td><td>${p.indice + 1}</td><td>${esc(p.variedade || '-')}</td><td class="d">${esc(ha(p.areaM2))}</td></tr>`).join('');
  const linhasTotais = totaisPorVariedade(plano.partes).map((v) => {
    const c = compararComMeta(v.areaM2, plano.metaHa);
    const selo = c.selo === 'sem-meta' ? '' : c.selo === 'ok' ? '<span class="ok">na meta</span>' : `<span class="at">${c.diffHa > 0 ? '+' : ''}${esc(c.diffHa.toFixed(1).replace('.', ','))} ha</span>`;
    return `<tr><td>${esc(v.variedade)}${v.partes > 1 ? ` (${v.partes} partes)` : ''}</td><td class="d">${selo}</td><td class="d">${esc(ha(v.areaM2))}</td></tr>`;
  }).join('');
  const conferencia = talhoes && talhoes.length
    ? `<h2>Conferência de áreas</h2><table><tbody>${conferirAreas(plano, talhoes).map((c) => `<tr><td>${esc(nomeTalhao(c.talhaoId))}</td><td>partes ${esc(ha(c.partesM2))} de ${esc(ha(c.medidaM2))} medidos${c.corredorEsperadoM2 > 1 ? ` (corredor ${esc(ha(c.corredorEsperadoM2))})` : ''}</td><td class="d ${c.alerta ? 'at' : 'ok'}">${esc(formatarPercentual(c.diffPercentual))}</td></tr>`).join('')}</tbody></table>`
    : '';
  const linhasBandeiras = plano.bandeiras.map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.rotulo)}</td><td>${grau(b.coord[1])}</td><td>${grau(b.coord[0])}</td><td class="d"><a href="https://www.google.com/maps?q=${b.coord[1]},${b.coord[0]}">abrir</a></td></tr>`).join('');

  const corpo = `<div id="gt-impressao">
<div class="topo"><div><b>GPSThomas</b><small>Plano de campo de sementes</small></div><div class="dir">${esc(agora.toLocaleDateString('pt-BR'))}<br>${esc(fazenda ?? '')}</div></div>
<h1>${esc(plano.nome)}</h1><p class="res">${esc(resumo)}</p>
${svgMapa(dados)}
<h2>Variedades</h2><div class="leg">${legenda}</div>
<h2>Partes</h2><table><thead><tr><th>Talhão</th><th>Parte</th><th>Variedade</th><th class="d">Área</th></tr></thead><tbody>${linhasPartes}<tr><td><b>Total</b></td><td></td><td></td><td class="d"><b>${esc(ha(totalM2))}</b></td></tr></tbody></table>
<h2>Total por variedade</h2><table><tbody>${linhasTotais}</tbody></table>${plano.metaHa ? `<p class="res">Meta por variedade: ${esc(formatarNumeroBR(plano.metaHa))} ha (tolerância de 0,3 ha ou 2%)</p>` : ''}
${conferencia}
<div class="pag"></div><h2>Bandeirinhas (pontos das divisas)</h2><p class="res">Toque no link para abrir o ponto no Google Maps. Coordenadas em graus decimais (WGS 84).</p>
<table><thead><tr><th>Nº</th><th>Ponto</th><th>Latitude</th><th>Longitude</th><th class="d">Mapa</th></tr></thead><tbody>${linhasBandeiras}</tbody></table>
<div class="rod">GPSThomas · Campo de sementes. Medidas feitas com GPS de celular têm erro de 3 a 10 m; confira em campo.</div>
</div>`;
  return { css: CSS_IMPRESSAO, corpo };
}

export type ResultadoImpressao = 'impresso' | 'indisponivel';

/** Coloca o plano na página (invisível na tela) e esconde o resto do app só na hora de imprimir. */
function injetar({ css, corpo }: { css: string; corpo: string }, titulo: string): () => void {
  document.getElementById('gt-impressao')?.remove();
  document.getElementById('gt-impressao-css')?.remove();
  const st = document.createElement('style');
  st.id = 'gt-impressao-css';
  st.textContent = css + CSS_SO_PLANO;
  const caixa = document.createElement('div');
  caixa.innerHTML = corpo;
  const raiz = caixa.firstElementChild as HTMLElement;
  document.head.appendChild(st);
  document.body.appendChild(raiz);
  const antes = document.title;
  document.title = titulo;
  return () => { raiz.remove(); st.remove(); document.title = antes; };
}

/** Abre a impressão do plano: mostra só o plano, chama window.print() e limpa depois. */
export async function imprimirPlano(dados: DadosPdf): Promise<ResultadoImpressao> {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window.print !== 'function') return 'indisponivel';
  const limpar0 = injetar(montarHtmlPlano(dados), dados.plano.nome);
  const limpar = () => { limpar0(); window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
  await new Promise((r) => requestAnimationFrame(() => r(null))); // dá um quadro para o navegador montar o layout
  window.print();
  return 'impresso';
}
