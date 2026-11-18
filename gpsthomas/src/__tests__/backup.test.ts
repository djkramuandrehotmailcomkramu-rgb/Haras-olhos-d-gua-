import { gerarBackup, restaurarBackup, esquemaBackup } from '../io/backup';
import { useDados } from '../store/dados';
import { usePrefs } from '../store/prefs';

const sq = [[-47.93, -15.78], [-47.92, -15.78], [-47.92, -15.77], [-47.93, -15.77]] as [number, number][];

beforeEach(() => {
  useDados.setState({ talhoes: [], medicoes: [], viagens: [], campos: [] });
  usePrefs.setState({ unidadeArea: 'ha', camada: 'satelite', favoritos: [], recentes: [] });
});

describe('backup e restauração', () => {
  it('ida e volta preserva os dados', () => {
    useDados.getState().adicionarTalhao({ nome: 'T1', fazenda: 'F', cultura: 'Soja', safra: '2026/27', contorno: sq });
    useDados.getState().adicionarMedicao({ tipo: 'linha', nome: 'cerca', pontos: sq.slice(0, 2), origem: 'mapa' });
    usePrefs.getState().definirUnidadeArea('alqPaulista');
    const b = gerarBackup(new Date('2026-11-17T12:00:00Z'));
    expect(b.geradoEm).toBe('2026-11-17T12:00:00.000Z');
    const txt = JSON.stringify(b);

    useDados.setState({ talhoes: [], medicoes: [] });
    usePrefs.setState({ unidadeArea: 'ha' });
    const r = restaurarBackup(txt);
    expect(r.ok).toBe(true);
    expect(useDados.getState().talhoes).toHaveLength(1);
    expect(useDados.getState().talhoes[0].nome).toBe('T1');
    expect(useDados.getState().medicoes).toHaveLength(1);
    expect(usePrefs.getState().unidadeArea).toBe('alqPaulista');
  });
  it('campo de sementes "juntos" (junto, origens e linha AB) sobrevive ao backup', () => {
    const plano = {
      id: 'p1', nome: 'Juntos', criadoEm: 1, config: [{ talhaoId: 'a', partes: 0, anguloGraus: null, inverter: false }], corredorM: 0, espacamentoM: 0, variedades: ['V1'], metaHa: 16,
      partes: [{ talhaoId: 'junto', indice: 0, pedacos: [sq], areaM2: 160000, variedade: 'V1', origens: [{ talhaoId: 'a', areaM2: 100000 }, { talhaoId: 'm', areaM2: 60000 }] }],
      bandeiras: [], divisas: [],
      junto: { talhaoIds: ['a', 'm'], haPorParte: 16, areaInformadaHa: 164, anguloGraus: null, linhaAB: { nome: 'TRABALHO', a: [-46.13416156, -16.282406] as [number, number], b: [-46.14329233, -16.28437727] as [number, number] }, usarLinhaAB: true, inverter: false, sobra: 'extra' as const },
    };
    useDados.setState({ campos: [plano] });
    const txt = JSON.stringify(gerarBackup());
    useDados.setState({ campos: [] });
    expect(restaurarBackup(txt).ok).toBe(true);
    const c = useDados.getState().campos[0];
    expect(c.junto?.linhaAB?.nome).toBe('TRABALHO');
    expect(c.junto?.haPorParte).toBe(16);
    expect(c.partes[0].origens).toHaveLength(2);
  });
  it('rejeita arquivo que não é JSON, de outro app ou com coordenada impossível', () => {
    expect(restaurarBackup('isto não é json')).toMatchObject({ ok: false });
    expect(restaurarBackup('{"app":"Outro"}')).toMatchObject({ ok: false });
    const ruim = { ...gerarBackup(), dados: { talhoes: [{ id: 'x', nome: 'n', fazenda: 'f', cultura: 'c', safra: 's', contorno: [[999, 0]], criadoEm: 1 }], medicoes: [] } };
    expect(restaurarBackup(JSON.stringify(ruim))).toMatchObject({ ok: false });
  });
  it('não apaga nada quando o backup é inválido', () => {
    useDados.getState().adicionarTalhao({ nome: 'Fica', fazenda: 'F', cultura: 'Soja', safra: '', contorno: sq });
    restaurarBackup('{"app":"GPSThomas"}');
    expect(useDados.getState().talhoes).toHaveLength(1);
  });
  it('esquema aceita backup antigo sem campos e viagens', () => {
    const antigo = { app: 'GPSThomas', versaoBackup: 1, geradoEm: 'x', dados: { talhoes: [], medicoes: [] } };
    expect(esquemaBackup.safeParse(antigo).success).toBe(true);
  });
});
