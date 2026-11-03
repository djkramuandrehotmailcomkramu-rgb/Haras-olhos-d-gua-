import { useMemo } from 'preact/hooks';
import { aba, erros } from '../state';
import { Carregando, SeletorEscopo, useVisao } from './comum';
import { fatorCorrecao, fmtDia, fmtHora, fmtJanela, fmtMm, horaMaisProvavel, semaforos, somaMm } from '../../shared/calc';
import { NOME_MODELO, MODELOS } from '../../shared/tipos';
import { addDias } from '../../shared/calc';
import { medidoPeriodo, chaveCelula } from '../derive';
import { IcAlerta, IcColheita, IcCompartilhar, IcSemente, IcSpray } from '../icons';

const ROT: Record<string, string> = { verde: 'Liberado', amarelo: 'Atenção', vermelho: 'Evitar', 'sem-dados': 'Sem dados' };

export function Hoje() {
  const x = useVisao();
  const dados = useMemo(() => {
    if (!x) return null;
    const { v, hoje, tid, ms, lim } = x;
    const dia = v.dias.find((d) => d.data === hoje);
    const horasDia = v.horas.filter((h) => h.data === hoje);
    const agora = Math.floor(Date.now() / 1000);
    const restante = somaMm(horasDia.filter((h) => h.ts + 3600 > agora));
    const prox24 = v.horas.filter((h) => h.ts + 3600 > agora && h.ts < agora + 24 * 3600);
    const med3 = medidoPeriodo(ms, addDias(hoje, -3), addDias(hoje, -1), tid);
    const temMedida = ms.length > 0;
    return { dia, horasDia, restante, prox24, sem: semaforos(horasDia.filter((h) => h.ts + 3600 > agora), dia?.provavel ?? null, temMedida ? med3 : null, lim) };
  }, [x?.p.gerado_em, x?.tid, x?.ms, x?.lim, erros.value]);

  if (!x || !dados) return <Carregando />;
  const { p, g, hoje, t, medidoHoje } = x;
  const { dia, horasDia, restante, prox24, sem } = dados;
  const fc = fatorCorrecao(erros.value);
  const max = Math.max(1, ...prox24.map((h) => h.mm ?? 0));
  const hp = horaMaisProvavel(horasDia);

  const resumo = () => {
    const dd = x.v.dias;
    const am = dd.find((d) => d.data === addDias(hoje, 1));
    const sem7 = dd.filter((d) => d.data >= hoje && d.data < addDias(hoje, 7)).reduce((s, d) => s + (d.provavel ?? 0), 0);
    const top = p.grupos.length ? '' : '';
    void top;
    return [
      `*Chuva — Fazenda Lagoa Formosa* (${fmtDia(hoje)})`,
      `Hoje: ${fmtMm(dia?.provavel)} mm (${Math.round(dia?.prob ?? 0)}% de chance)`,
      `Amanhã: ${fmtMm(am?.provavel)} mm (${Math.round(am?.prob ?? 0)}%)`,
      `Próximos 7 dias: ${fmtMm(sem7)} mm`,
      medidoHoje != null ? `Já choveu hoje (medido): ${fmtMm(medidoHoje)} mm` : '',
      '_Isto é previsão, não garantia de chuva._',
    ]
      .filter(Boolean)
      .join('\n');
  };
  const whats = () => window.open(`https://wa.me/?text=${encodeURIComponent(resumo())}`, '_blank');

  return (
    <>
      <div class="card hero">
        <div class="row sp">
          <h2 style="margin:0">Hoje · {fmtDia(hoje)}</h2>
          <button class="ib" aria-label="Enviar resumo no WhatsApp" onClick={whats}>
            <IcCompartilhar />
          </button>
        </div>
        <SeletorEscopo />
        <div class="row" style="margin-top:14px;align-items:flex-end">
          <div class="big">
            {fmtMm(dia?.provavel)}
            <small>mm</small>
          </div>
          <div class="kv">
            <b>{dia?.prob != null ? `${Math.round(dia.prob)}%` : '—'}</b>
            <span>chance de chuva</span>
          </div>
        </div>
        <div class="row" style="margin-top:14px">
          <div class="kv">
            <b>{fmtMm(dia?.min)}–{fmtMm(dia?.max)} mm</b>
            <span>faixa (modelo mais seco – mais úmido)</span>
          </div>
          <div class="kv">
            <b>{hp != null ? fmtHora(hp) : '—'}</b>
            <span>hora mais provável</span>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <div class="kv">
            <b>{medidoHoje != null ? `${fmtMm(medidoHoje)} mm` : 'sem lançamento'}</b>
            <span>já choveu (medido)</span>
          </div>
          <div class="kv">
            <b>{fmtMm(restante)} mm</b>
            <span>ainda previsto hoje</span>
          </div>
        </div>
        <div class="aviso">
          Bruto (média dos modelos): <b>{fmtMm(dia?.bruto)} mm</b> · corrigido: <b>{fmtMm(dia?.provavel)} mm</b>.{' '}
          {fc.ativo
            ? `Correção ×${fc.fator.toFixed(2).replace('.', ',')} com ${fc.nDias} dias de pluviômetro.`
            : `Sem correção de viés ainda: calibrando (${fc.nDias} de 20 dias medidos).`}
          <br />
          Fonte: {MODELOS.filter((m) => dia?.porModelo[m]).map((m) => NOME_MODELO[m]).join(' · ')} ({dia?.nModelos ?? 0} modelos) · célula {chaveCelula(g)}
          {t ? ` · ${t.nome}` : ` · grupo ${g.id}`}.
        </div>
      </div>

      <div class="card">
        <h2>Próximas 24 h</h2>
        <div class="bars" role="img" aria-label="Chuva prevista por hora nas próximas 24 horas">
          {prox24.map((h) => (
            <i class={(h.mm ?? 0) < 0.05 ? 'z' : ''} style={`height:${Math.max(3, ((h.mm ?? 0) / max) * 100)}%`} title={`${fmtHora(h.hora)}: ${fmtMm(h.mm)} mm`} />
          ))}
        </div>
        <div class="axis">
          <span>{prox24[0] ? fmtHora(prox24[0].hora) : ''}</span>
          <span>máx. {fmtMm(max)} mm/h</span>
          <span>{prox24.length ? fmtHora(prox24[prox24.length - 1].hora) : ''}</span>
        </div>
      </div>

      <div class="card">
        <h2>Operações de hoje</h2>
        {(
          [
            ['Pulverização', sem.pulverizacao, <IcSpray />],
            ['Plantio', sem.plantio, <IcSemente />],
            ['Colheita', sem.colheita, <IcColheita />],
          ] as const
        ).map(([nome, s, ic]) => (
          <div class="sem">
            <span class={`dot ${s.estado}`} aria-hidden="true" />
            <div class="t">
              <b>
                {ic} {nome} — {ROT[s.estado]}
              </b>
              <span class="muted">{s.motivo}</span>
            </div>
            <div class="j" aria-label="Melhor janela">{fmtJanela(s.janela)}</div>
          </div>
        ))}
        <div class="row sp" style="margin-top:6px">
          <span class="muted">Melhor janela do dia (6h–20h). Limites editáveis em Ajustes.</span>
          <button class="chip" onClick={() => (aba.value = 'ajustes')}>
            Limites
          </button>
        </div>
        <div class="aviso">
          <IcAlerta size={14} /> Confirme sempre pela bula do produto e pelo receituário agronômico antes de aplicar.
        </div>
      </div>
    </>
  );
}
