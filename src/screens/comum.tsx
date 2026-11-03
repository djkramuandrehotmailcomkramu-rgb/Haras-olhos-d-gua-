import { payload, erros, talhoes, escopo, medidas, limites, lugar, payloadLugar, abrirLugar } from '../state';
import { grupoDoTalhao, grupoReferencia, visaoGrupo, medidoDia } from '../derive';
import { hojeLocal } from '../../shared/calc';

export function Carregando() {
  return (
    <>
      <div class="sk" />
      <div class="sk" style="margin-top:12px" />
    </>
  );
}

/** Visão do escopo escolhido: um local pesquisado (cidade/estado/GPS), a fazenda toda (grupo de referência) ou um talhão. */
export function useVisao() {
  const l = lugar.value;
  if (l) {
    const pl = payloadLugar.value;
    if (!pl || pl.lugar.lat !== l.lat || pl.lugar.lon !== l.lon) return null;
    const p = {
      fazenda: { id: 'ponto', nome: l.nome, fuso: pl.fuso, lat: l.lat, lon: l.lon },
      gerado_em: pl.gerado_em,
      grupos: [pl.grupo],
      erros: pl.erros,
    };
    const v = visaoGrupo(p, pl.grupo, pl.hind);
    return { p, g: pl.grupo, v, hoje: hojeLocal(pl.fuso), tid: null as string | null, t: null, ms: [] as typeof medidas.value, lim: limites.value, medidoHoje: null as number | null, erros: pl.hind, lugar: l };
  }
  const p = payload.value;
  if (!p) return null;
  const tid = escopo.value === 'fazenda' ? null : escopo.value;
  const g = (tid && grupoDoTalhao(p, tid)) || grupoReferencia(p);
  const v = visaoGrupo(p, g, erros.value);
  const hoje = hojeLocal(p.fazenda.fuso);
  const t = tid ? talhoes.value.find((x) => x.id === tid) : null;
  return { p, g, v, hoje, tid, t, ms: medidas.value, lim: limites.value, medidoHoje: medidoDia(medidas.value, hoje, tid), erros: erros.value, lugar: null as typeof l };
}

export function SeletorEscopo() {
  if (lugar.value) return null;
  return (
    <>
      <label for="esc">Local</label>
      <select id="esc" value={escopo.value} onChange={(e) => (escopo.value = (e.target as HTMLSelectElement).value)}>
        <option value="fazenda">Fazenda toda (referência)</option>
        {talhoes.value.map((t) => (
          <option value={t.id}>{t.nome}</option>
        ))}
      </select>
    </>
  );
}

export function LugarChip() {
  const l = lugar.value;
  if (!l) return null;
  return (
    <div class="lugar-chip" role="status">
      <b>{l.nome}</b>
      <span class="muted">
        {l.detalhe || `${l.lat}, ${l.lon}`}
        {l.tipo === 'Estado' ? ' · ponto central do estado' : ''}
      </span>
      <button class="lk" onClick={() => abrirLugar(null)}>
        Voltar para a fazenda
      </button>
    </div>
  );
}
