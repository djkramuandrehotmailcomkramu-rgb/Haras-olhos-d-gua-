import { documentoHtmlPlano, esc, montarHtmlPlano } from '../io/htmlImpressao';
import { gerarCampoJunto } from '../geo/campo';
import type { ConfigJunto, PlanoCampo, Talhao } from '../store/dados';
import type { Coord } from '../geo/medidas';

const KX = Math.cos((-16.285 * Math.PI) / 180) * 111319.49;
const KY = 111319.49;
const base: Coord = [-46.13, -16.285];
const pt = (dx: number, dy: number): Coord => [base[0] + dx / KX, base[1] + dy / KY];
const ret = (x0: number, y0: number, x1: number, y1: number): Coord[] => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
const tal = (id: string, nome: string, contorno: Coord[]): Talhao => ({ id, nome, fazenda: 'Lagoa', cultura: '', safra: '', contorno, criadoEm: 0 });
const T = [tal('a', 'Andropgno <b>', ret(0, 0, 2000, 460)), tal('m', 'Amendoim & Cia', ret(-1665, 0, -100, 460))];
const junto: ConfigJunto = { talhaoIds: ['a', 'm'], haPorParte: 16, anguloGraus: 90, usarLinhaAB: true, linhaAB: { nome: 'TRABALHO', a: pt(-500, 700), b: pt(500, 700) }, inverter: false, sobra: 'extra' };

function plano(): PlanoCampo {
  const r = gerarCampoJunto(T, junto, 0, 0);
  const variedades = ['V1 <script>alert(1)</script>', 'V2'];
  return {
    id: 'p', nome: 'Plano "teste" <i>', criadoEm: Date.UTC(2026, 10, 17), config: [], corredorM: 0, espacamentoM: 0, variedades, metaHa: 16,
    partes: r.partes.map((p, i) => ({ ...p, variedade: variedades[i % 2] })), bandeiras: r.bandeiras, divisas: r.divisas, junto,
  };
}
const dados = () => ({ plano: plano(), nomeTalhao: (id: string) => (id === 'junto' ? 'Andropgno <b> + Amendoim & Cia' : T.find((x) => x.id === id)?.nome ?? 'Talhão'), fazenda: 'Fazenda Lagoa Formosa', talhoes: T });

describe('impressão do plano (HTML)', () => {
  it('escapa texto do usuário', () => {
    expect(esc('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
  it('traz título, resumo, mapa, partes, bandeirinhas com link do Maps e a linha AB', () => {
    const d = dados();
    const { corpo, css } = montarHtmlPlano(d, new Date(Date.UTC(2026, 10, 17, 12)));
    expect(corpo).toContain('id="gt-impressao"');
    expect(corpo).toContain('Plano de campo de sementes');
    expect(corpo).toContain('talhões juntos, partes de 16,00 ha, faixas paralelas ao rastro TRABALHO');
    expect(corpo).toContain('<svg');
    expect(corpo).toMatch(/>A<\/text>/);
    expect(corpo).toContain('stroke-dasharray="7 5"');
    expect(corpo.match(/<circle/g)!.length).toBeGreaterThanOrEqual(d.plano.bandeiras.length);
    expect((corpo.match(/google\.com\/maps\?q=/g) ?? []).length).toBe(d.plano.bandeiras.length);
    for (let i = 1; i <= d.plano.partes.length; i++) expect(corpo).toContain(`<td>${i}</td>`);
    expect(corpo).toContain('Conferência de áreas');
    expect(corpo).toContain('GPS de celular têm erro de 3 a 10 m');
    expect(css).toContain('@page');
  });
  it('nada do que o usuário digitou vira HTML', () => {
    const { corpo } = montarHtmlPlano(dados());
    expect(corpo).not.toContain('<script>');
    expect(corpo).not.toContain('Andropgno <b>');
    expect(corpo).not.toContain('teste&quot; <i>');
    expect(corpo).toContain('&lt;script&gt;');
    expect(corpo).toContain('Amendoim &amp; Cia');
  });
  it('documento completo para a impressão do Android', () => {
    const html = documentoHtmlPlano(dados());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Plano &quot;teste&quot; &lt;i&gt;</title>');
    expect(html).toContain('#gt-impressao{display:block!important}');
  });
});
