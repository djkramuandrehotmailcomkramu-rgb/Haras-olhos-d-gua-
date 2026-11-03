import { useState } from 'preact/hooks';
import { Carregando, SeletorEscopo, useVisao } from './comum';
import { addDias, fmtDia, fmtHora, fmtMm } from '../../shared/calc';
import { medidoPeriodo, previstoPeriodo } from '../derive';

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function Semana() {
  const x = useVisao();
  const [aberto, setAberto] = useState<string | null>(null);
  if (!x) return <Carregando />;
  const { v, hoje, tid, ms } = x;
  const dias = v.dias.filter((d) => d.data >= hoje).slice(0, 15);
  const maxDia = Math.max(5, ...dias.map((d) => d.provavel ?? 0));
  const prev7 = previstoPeriodo(v, hoje, 7);
  const med7 = medidoPeriodo(ms, addDias(hoje, -7), addDias(hoje, -1), tid);
  const med7ant = medidoPeriodo(ms, addDias(hoje, -14), addDias(hoje, -8), tid);
  const temMed = ms.length > 0;

  const resumoDia = (data: string) => {
    const hs = v.horas.filter((h) => h.data === data);
    const venMax = Math.max(...hs.map((h) => h.vento ?? 0));
    const ts = hs.map((h) => h.temp).filter((t): t is number => t != null);
    return { hs, venMax: hs.some((h) => h.vento != null) ? venMax : null, tMin: ts.length ? Math.min(...ts) : null, tMax: ts.length ? Math.max(...ts) : null };
  };

  return (
    <>
      <div class="card">
        <SeletorEscopo />
      </div>
      <div class="card">
        <h2>Comparativo (medido × previsto)</h2>
        <div class="row sp">
          <div class="kv">
            <b>{fmtMm(prev7)} mm</b>
            <span>previsto próximos 7 dias</span>
          </div>
          <div class="kv">
            <b>{temMed ? `${fmtMm(med7)} mm` : '—'}</b>
            <span>medido últimos 7 dias</span>
          </div>
          <div class="kv">
            <b>{temMed ? `${fmtMm(med7ant)} mm` : '—'}</b>
            <span>medido semana anterior</span>
          </div>
        </div>
        {!temMed && <div class="aviso">Sem lançamentos de pluviômetro ainda: o comparativo usa só chuva medida, nunca estimada.</div>}
      </div>
      <div class="card">
        <h2>Próximos {dias.length} dias</h2>
        {dias.map((d, i) => {
          const r = resumoDia(d.data);
          const abre = aberto === d.data;
          const dow = SEM[new Date(d.data + 'T12:00:00Z').getUTCDay()];
          return (
            <div class="day" key={d.data}>
              <div class="h" role="button" tabIndex={0} aria-expanded={abre} onClick={() => setAberto(abre ? null : d.data)} onKeyDown={(e) => e.key === 'Enter' && setAberto(abre ? null : d.data)}>
                <div class="d">
                  {i === 0 ? 'Hoje' : fmtDia(d.data)}
                  <small>{dow}</small>
                </div>
                <div class="m">{fmtMm(d.provavel)}</div>
                <div style="flex:1">
                  <div class="f" aria-hidden="true">
                    <i style={`width:${Math.min(100, ((d.provavel ?? 0) / maxDia) * 100)}%`} />
                  </div>
                  <div class="muted" style="margin-top:4px">
                    {d.prob != null ? `${Math.round(d.prob)}%` : '—'} · faixa {fmtMm(d.q10 ?? d.min)}–{fmtMm(d.q90 ?? d.max)} mm
                  </div>
                  <div class="muted">
                    {r.venMax != null ? `vento ${Math.round(r.venMax)} km/h` : 'vento —'} · {r.tMin != null ? `${Math.round(r.tMin)}–${Math.round(r.tMax!)} °C` : 'temp. —'}
                  </div>
                </div>
              </div>
              {abre && (
                <div class="hrs">
                  {r.hs
                    .filter((h) => h.hora % 2 === 0)
                    .map((h) => (
                      <div>
                        {fmtHora(h.hora)}
                        <b>{fmtMm(h.mm)} mm</b>
                        {h.prob != null ? `${Math.round(h.prob)}%` : ''}
                      </div>
                    ))}
                </div>
              )}
              {abre && d.nModelos < 4 && <div class="aviso">Só {d.nModelos} de 4 modelos cobrem este dia; a faixa é mais incerta.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
