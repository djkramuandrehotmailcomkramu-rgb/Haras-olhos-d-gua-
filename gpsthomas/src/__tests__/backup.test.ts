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
