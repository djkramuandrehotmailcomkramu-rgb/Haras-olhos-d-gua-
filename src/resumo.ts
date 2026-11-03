import { addDias, fmtDia, fmtMm, hojeLocal } from '../shared/calc';
import { erros, medidas, payload, talhoes } from './state';
import { grupoDoTalhao, grupoReferencia, medidoDia, previstoPeriodo, visaoGrupo } from './derive';

/** Texto do resumo para WhatsApp: hoje, amanhã, semana, 5 talhões com mais chuva e a ressalva. */
export function textoResumo(): string | null {
  const p = payload.value;
  if (!p) return null;
  const hoje = hojeLocal(p.fazenda.fuso);
  const v = visaoGrupo(p, grupoReferencia(p), erros.value);
  const d0 = v.dias.find((d) => d.data === hoje);
  const d1 = v.dias.find((d) => d.data === addDias(hoje, 1));
  const top = talhoes.value
    .map((t) => {
      const g = grupoDoTalhao(p, t.id);
      return { nome: t.nome, mm: g ? previstoPeriodo(visaoGrupo(p, g, erros.value), hoje, 3) : 0 };
    })
    .sort((a, b) => b.mm - a.mm)
    .slice(0, 5);
  const med = medidoDia(medidas.value, hoje, null);
  return [
    `*Chuva — Fazenda Lagoa Formosa* (${fmtDia(hoje)})`,
    `Hoje: ${fmtMm(d0?.provavel)} mm (${Math.round(d0?.prob ?? 0)}% de chance)`,
    `Amanhã: ${fmtMm(d1?.provavel)} mm (${Math.round(d1?.prob ?? 0)}%)`,
    `Próximos 7 dias: ${fmtMm(previstoPeriodo(v, hoje, 7))} mm`,
    med != null ? `Já choveu hoje (medido): ${fmtMm(med)} mm` : '',
    '',
    '*Talhões com mais chuva (3 dias):*',
    ...top.map((t, i) => `${i + 1}. ${t.nome}: ${fmtMm(t.mm)} mm`),
    '',
    '_Isto é previsão, não garantia de chuva. Confirme pela bula e receituário._',
  ]
    .filter((x) => x !== null)
    .join('\n');
}

export function compartilharWhats() {
  const t = textoResumo();
  if (t) window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
}
