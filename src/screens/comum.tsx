import { payload, erros, talhoes, escopo, medidas, limites } from '../state';
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

/** Visão do escopo escolhido (fazenda inteira → grupo de referência; ou um talhão). */
export function useVisao() {
  const p = payload.value;
  if (!p) return null;
  const tid = escopo.value === 'fazenda' ? null : escopo.value;
  const g = (tid && grupoDoTalhao(p, tid)) || grupoReferencia(p);
  const v = visaoGrupo(p, g, erros.value);
  const hoje = hojeLocal(p.fazenda.fuso);
  const t = tid ? talhoes.value.find((x) => x.id === tid) : null;
  return { p, g, v, hoje, tid, t, ms: medidas.value, lim: limites.value, medidoHoje: medidoDia(medidas.value, hoje, tid) };
}

export function SeletorEscopo() {
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
