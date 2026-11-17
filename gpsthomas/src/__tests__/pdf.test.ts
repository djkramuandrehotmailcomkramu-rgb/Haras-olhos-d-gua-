import { nomeArquivoPdf } from '../io/pdfCampo';
import { gerarCampo, distribuirVariedades } from '../geo/campo';
import type { Coord } from '../geo/medidas';
import type { PlanoCampo, Talhao } from '../store/dados';

const KX = Math.cos((-15.78 * Math.PI) / 180) * 111319.49;
const KY = 111319.49;
const base: Coord = [-47.93, -15.78];
const pt = (dx: number, dy: number): Coord => [base[0] + dx / KX, base[1] + dy / KY];

const tA: Talhao = { id: 'a', nome: 'Andropogon', fazenda: 'Lagoa Formosa', cultura: 'Pastagem', safra: '2026/27', contorno: [pt(0, 0), pt(2000, 0), pt(2000, 460), pt(0, 460)], criadoEm: 0 };
const tB: Talhao = { id: 'b', nome: 'Amendoim', fazenda: 'Lagoa Formosa', cultura: 'Amendoim', safra: '2026/27', contorno: [pt(0, 600), pt(1200, 600), pt(1200, 1200), pt(0, 1200)], criadoEm: 0 };

function plano(): PlanoCampo {
  const g = gerarCampo([tA, tB], [{ talhaoId: 'a', partes: 5, anguloGraus: null, inverter: false }, { talhaoId: 'b', partes: 6, anguloGraus: null, inverter: false }], 0, 0);
  const v = Array.from({ length: 10 }, (_, i) => `Variedade ${i + 1}`);
  return { id: 'p', nome: 'Campo de sementes: Lagoa Formosa', criadoEm: Date.UTC(2026, 10, 17), config: [], corredorM: 0, espacamentoM: 0, variedades: v, partes: distribuirVariedades(g.partes, v), bandeiras: g.bandeiras, divisas: g.divisas };
}

describe('PDF do campo de sementes', () => {
  it('nome de arquivo seguro', () => {
    expect(nomeArquivoPdf('Campo de sementes: Lagoa Formosa')).toBe('Campo-de-sementes-Lagoa-Formosa.pdf');
    expect(nomeArquivoPdf('///')).toBe('campo-de-sementes.pdf');
  });
  it('o plano de teste tem 11 partes e 18 bandeirinhas', () => {
    const p = plano();
    expect(p.partes).toHaveLength(11);
    expect(p.bandeiras).toHaveLength(18);
  });
});
