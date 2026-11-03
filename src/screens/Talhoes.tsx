import { useMemo, useState } from 'preact/hooks';
import { aba, escopo, erros, medidas, limites, payload, talhoes } from '../state';
import { Carregando } from './comum';
import { LEGENDA_FAIXAS, addDias, faixaMm, fmtMm, hojeLocal } from '../../shared/calc';
import { grupoDoTalhao, inicioSafra, medidoPeriodo, previstoPeriodo, talhoesNaCelula, visaoGrupo } from '../derive';

type Per = 'hoje' | '3d' | '7d' | '15d' | 'safra';
type Ord = 'chuva' | 'chance' | 'nome';
const PERS: [Per, string][] = [['hoje', 'Hoje'], ['3d', '3 dias'], ['7d', '7 dias'], ['15d', '15 dias'], ['safra', 'Safra (medido)']];
const N: Record<string, number> = { hoje: 1, '3d': 3, '7d': 7, '15d': 15 };

export const CORES_FAIXA = ['#334155', '#7dd3fc', '#38bdf8', '#2563eb', '#7c3aed', '#c026d3'];

export function useLinhas(per: Per) {
  const p = payload.value;
  return useMemo(() => {
    if (!p) return [];
    const hoje = hojeLocal(p.fazenda.fuso);
    return talhoes.value.map((t) => {
      const g = grupoDoTalhao(p, t.id);
      if (!g) return { t, g: null, mm: null as number | null, prob: null as number | null, celula: 1 };
      const v = visaoGrupo(p, g, erros.value);
      let mm: number | null;
      if (per === 'safra') mm = medidoPeriodo(medidas.value, inicioSafra(hoje, limites.value.safra_inicio), hoje, t.id);
      else mm = previstoPeriodo(v, hoje, N[per]);
      const probs = v.dias.filter((d) => d.data >= hoje && d.data < addDias(hoje, N[per] || 1)).map((d) => d.prob ?? 0);
      return { t, g, mm, prob: probs.length ? Math.max(...probs) : null, celula: talhoesNaCelula(p, t.id) };
    });
  }, [p?.gerado_em, talhoes.value, per, medidas.value, erros.value, limites.value]);
}

export function Talhoes() {
  const [per, setPer] = useState<Per>('hoje');
  const [ord, setOrd] = useState<Ord>('chuva');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('todos');
  const linhas = useLinhas(per);
  const p = payload.value;
  if (!p) return <Carregando />;
  const lista = linhas
    .filter((l) => l.t.nome.toLowerCase().includes(busca.toLowerCase()) && (grupo === 'todos' || l.g?.id === grupo))
    .sort((a, b) => (ord === 'nome' ? a.t.nome.localeCompare(b.t.nome) : ord === 'chance' ? (b.prob ?? -1) - (a.prob ?? -1) : (b.mm ?? -1) - (a.mm ?? -1)));
  const celulasUnicas = new Set(p.grupos.map((g) => `${g.grade.lat.toFixed(3)},${g.grade.lon.toFixed(3)}`)).size;

  return (
    <>
      <div class="card">
        <label for="b">Buscar talhão</label>
        <input id="b" type="search" placeholder="ex.: Palmeira" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} />
        <div class="chips" style="margin-top:10px" role="group" aria-label="Período">
          {PERS.map(([id, nome]) => (
            <button class="chip" aria-pressed={per === id} onClick={() => setPer(id)}>
              {nome}
            </button>
          ))}
        </div>
        <div class="grid2">
          <div>
            <label for="o">Ordenar</label>
            <select id="o" value={ord} onChange={(e) => setOrd((e.target as HTMLSelectElement).value as Ord)}>
              <option value="chuva">Mais chuva</option>
              <option value="chance">Maior chance</option>
              <option value="nome">Nome</option>
            </select>
          </div>
          <div>
            <label for="g">Grupo</label>
            <select id="g" value={grupo} onChange={(e) => setGrupo((e.target as HTMLSelectElement).value)}>
              <option value="todos">Todos</option>
              {p.grupos.map((g) => (
                <option value={g.id}>
                  {g.id} ({g.talhoes.length})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div class="aviso">
          {talhoes.value.length} talhões em {p.grupos.length} grupos de ~{limites.value.agrupamento_km} km, usando {celulasUnicas} célula(s) distinta(s) do modelo. Talhões na mesma célula mostram o mesmo número porque o modelo não enxerga diferença entre eles.
          {per === 'safra' && ' Safra = chuva medida desde ' + inicioSafra(hojeLocal(p.fazenda.fuso), limites.value.safra_inicio).split('-').reverse().slice(0, 2).join('/') + '.'}
        </div>
      </div>
      <div class="card">
        {lista.map(({ t, g, mm, prob, celula }) => (
          <div class="tal" key={t.id} role="button" tabIndex={0} onClick={() => ((escopo.value = t.id), (aba.value = 'hoje'))}>
            <span class="dot" style={`background:${CORES_FAIXA[faixaMm(mm)]}`} aria-hidden="true" />
            <div class="n">
              <b>{t.nome}</b>
              <small>
                {t.ha ?? '—'} ha · grupo {g?.id ?? '—'}
                {celula > 1 ? ` · mesma célula que ${celula - 1} outro(s)` : ''}
              </small>
            </div>
            <div class="v">
              {fmtMm(mm)} <small class="muted">mm</small>
              {per !== 'safra' && <div class="muted" style="font-size:12px;font-weight:400">{prob != null ? `${Math.round(prob)}%` : '—'}</div>}
            </div>
          </div>
        ))}
        {!lista.length && <div class="muted">Nenhum talhão encontrado.</div>}
      </div>
      <div class="leg" aria-label="Legenda">
        {LEGENDA_FAIXAS.map((l, i) => (
          <span>
            <i style={`background:${CORES_FAIXA[i]}`} />
            {l} mm
          </span>
        ))}
      </div>
    </>
  );
}
