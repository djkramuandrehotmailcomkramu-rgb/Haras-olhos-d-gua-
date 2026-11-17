// Gera um PDF de exemplo para conferência visual:  npx tsx tools/gerar-pdf-exemplo.ts /caminho/saida.pdf
import { montarPdfCampo } from '../src/io/pdfCampo';
import { gerarCampo, distribuirVariedades } from '../src/geo/campo';
import type { Coord } from '../src/geo/medidas';
import type { PlanoCampo, Talhao } from '../src/store/dados';
import * as fs from 'fs';

const KX = Math.cos((-15.78 * Math.PI) / 180) * 111319.49, KY = 111319.49;
const pt = (dx: number, dy: number): Coord => [-47.93 + dx / KX, -15.78 + dy / KY];
const tA: Talhao = { id: 'a', nome: 'Andropogon', fazenda: 'Lagoa Formosa', cultura: 'Pastagem', safra: '2026/27', contorno: [pt(0, 0), pt(2000, 0), pt(2000, 460), pt(0, 460)], criadoEm: 0 };
const tB: Talhao = { id: 'b', nome: 'Amendoim', fazenda: 'Lagoa Formosa', cultura: 'Amendoim', safra: '2026/27', contorno: [pt(0, 600), pt(1200, 600), pt(1200, 1200), pt(0, 1200)], criadoEm: 0 };

(async () => {
  const g = gerarCampo([tA, tB], [{ talhaoId: 'a', partes: 5, anguloGraus: null, inverter: false }, { talhaoId: 'b', partes: 6, anguloGraus: null, inverter: false }], 0, 0);
  const v = ['Variedade A', 'Variedade B', 'Variedade C', 'Variedade D', 'Variedade E', 'Variedade F', 'Variedade G', 'Variedade H', 'Variedade I', 'Variedade J'];
  const plano: PlanoCampo = { id: 'p', nome: 'Campo de sementes - Lagoa Formosa', criadoEm: Date.UTC(2026, 10, 17), config: [], corredorM: 0, espacamentoM: 0, variedades: v, partes: distribuirVariedades(g.partes, v), bandeiras: g.bandeiras, divisas: g.divisas };
  const doc = await montarPdfCampo({ plano, nomeTalhao: (id) => (id === 'a' ? 'Andropogon' : 'Amendoim'), fazenda: 'Fazenda Lagoa Formosa' });
  fs.writeFileSync(process.argv[2] ?? 'plano.pdf', Buffer.from(doc.output('arraybuffer')));
  console.log('páginas:', doc.getNumberOfPages());
})();
