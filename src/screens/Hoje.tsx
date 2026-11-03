import { useMemo } from 'preact/hooks';
import { aba, diaSel, erros, horaSel, limites, operacao } from '../state';
import { Carregando, SeletorEscopo, useVisao } from './comum';
import { MODELOS, NOME_MODELO } from '../../shared/tipos';
import { addDias, calcularPesos, fatorCorrecao, fmtHora, fmtJanela, fmtMm, horasOk, horaMaisProvavel, partesLocais, semaforos, somaMm } from '../../shared/calc';
import type { Estado, Operacao, ValorHora } from '../../shared/calc';
import { medidoDia, medidoPeriodo } from '../derive';
import { IcAlerta, IcColheita, IcSemente, IcSpray } from '../icons';

const OPS: { id: Operacao; nome: string; Ic: (p: { size?: number }) => any; verbo: string }[] = [
  { id: 'pulv', nome: 'Pulverizar', Ic: IcSpray, verbo: 'pulverizar' },
  { id: 'plantio', nome: 'Plantar', Ic: IcSemente, verbo: 'plantar' },
  { id: 'colheita', nome: 'Colher', Ic: IcColheita, verbo: 'colher' },
];
const TITULO: Record<Estado, string> = { verde: 'Bom para', amarelo: 'Atenção para', vermelho: 'Não é bom para', 'sem-dados': 'Sem dados para' };
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
type Tom = 'verde' | 'amarelo' | 'vermelho' | 'neutro' | 'sol';

const Tile = ({ titulo, valor, sub, tom = 'neutro', children }: { titulo: string; valor?: string; sub?: string; tom?: Tom; children?: any }) => (
  <div class={`tile t-${tom}`}>
    <div class="tt">{titulo}</div>
    <div class="tv">{children ?? <Valor v={valor ?? '—'} />}</div>
    <div class="ts">{sub ?? ' '}</div>
  </div>
);

function Valor({ v }: { v: string }) {
  const m = /^([\d.,—-]+)\s*(.*)$/.exec(v);
  return m && m[2] ? (
    <span>
      {m[1]}
      <small class="un">{m[2].startsWith('°') || m[2].startsWith('%') ? m[2] : ` ${m[2]}`}</small>
    </span>
  ) : (
    <span>{v}</span>
  );
}

function Bussola({ dir }: { dir: number | null }) {
  if (dir == null) return <span>—</span>;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`vento vindo de ${Math.round(dir)} graus`}>
      <circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff55" stroke-width="1.5" stroke-dasharray="2 5" />
      <text x="32" y="11" font-size="9" fill="#fff" text-anchor="middle">N</text>
      <text x="32" y="60" font-size="9" fill="#fff" text-anchor="middle">S</text>
      <text x="7" y="35" font-size="9" fill="#fff" text-anchor="middle">O</text>
      <text x="57" y="35" font-size="9" fill="#fff" text-anchor="middle">L</text>
      <g transform={`rotate(${(dir + 180) % 360} 32 32)`}>
        <path d="M32 12 L40 40 L32 35 L24 40 Z" fill="#fff" />
      </g>
    </svg>
  );
}

const hhmm = (ts: number | undefined, fuso: string) =>
  ts ? new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts * 1000)) : '—';

export function Hoje() {
  const x = useVisao();
  const op = operacao.value;
  const lim = limites.value;

  const m = useMemo(() => {
    if (!x) return null;
    const { v, hoje, tid, ms } = x;
    const fuso = x.p.fazenda.fuso;
    const agoraTs = Date.now() / 1000;
    const horaAgora = partesLocais(agoraTs, fuso).hora;
    const dia = diaSel.value && v.dias.some((d) => d.data === diaSel.value) ? (diaSel.value as string) : hoje;
    const ehHoje = dia === hoje;
    const hora = horaSel.value ?? (ehHoje ? horaAgora : 12);
    const horasD = v.horas.filter((h) => h.data === dia);
    const d = v.dias.find((q) => q.data === dia);
    const med3 = ms.length ? medidoPeriodo(ms, addDias(dia, -3), addDias(dia, -1), tid) : null;
    const considerar = ehHoje ? horasD.filter((h) => h.ts + 3600 > agoraTs) : horasD;
    const sem = semaforos(considerar, d?.provavel ?? null, med3, lim);
    // estado de cada dia da faixa (dia inteiro, 6h–20h)
    const faixa = v.dias
      .filter((q) => q.data >= hoje)
      .slice(0, 14)
      .map((q) => {
        const hs = v.horas.filter((h) => h.data === q.data);
        const s = semaforos(hs, q.provavel, ms.length ? medidoPeriodo(ms, addDias(q.data, -3), addDias(q.data, -1), tid) : null, lim);
        return { data: q.data, s, mm: q.provavel };
      });
    // nascer/pôr do sol
    const md = x.g.meteo?.daily;
    const ix = md ? md.time.findIndex((t) => partesLocais(t + 3600, fuso).dia === dia) : -1;
    const nascer = ix >= 0 ? md?.sunrise?.[ix] : undefined;
    const por = ix >= 0 ? md?.sunset?.[ix] : undefined;
    const hh = horasD.find((h) => h.hora === hora) ?? null;
    const temps = horasD.map((h) => h.temp).filter((t): t is number => t != null);
    const ventos = horasD.map((h) => h.vento).filter((t): t is number => t != null);
    return { dia, ehHoje, hora, horasD, d, sem, faixa, nascer, por, hh, tMin: temps.length ? Math.min(...temps) : null, tMax: temps.length ? Math.max(...temps) : null, vMax: ventos.length ? Math.max(...ventos) : null, restante: somaMm(horasD.filter((h) => h.ts + 3600 > agoraTs)), fuso };
  }, [x?.p.gerado_em, x?.tid, x?.ms, lim, erros.value, op, diaSel.value, horaSel.value]);

  if (!x || !m) return <Carregando />;
  const { p, g, hoje, t, ms } = x;
  const { dia, ehHoje, hora, horasD, d, sem, faixa, hh } = m;
  const semOp = op === 'pulv' ? sem.pulverizacao : op === 'plantio' ? sem.plantio : sem.colheita;
  const info = OPS.find((o) => o.id === op)!;
  const ok = horasOk(op, horasD, lim);
  const maxMm = Math.max(1, ...horasD.map((h) => h.mm ?? 0));
  const fc = fatorCorrecao(erros.value);
  const dh = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86400000);
  const pesos = calcularPesos(erros.value, dh);
  const med = medidoDia(ms, dia, x.tid);
  const hp = horaMaisProvavel(horasD);

  const tomChuva: Tom = (d?.provavel ?? 0) <= 0.1 ? 'verde' : (d?.provavel ?? 0) <= (op === 'plantio' ? lim.plantio_dia_max : 1) ? 'amarelo' : 'vermelho';
  const tomProb: Tom = (d?.prob ?? 0) < 30 ? 'verde' : (d?.prob ?? 0) < 60 ? 'amarelo' : 'vermelho';
  const tomVento: Tom = hh?.vento == null ? 'neutro' : hh.vento <= lim.pulv_vento_max * 0.7 ? 'verde' : hh.vento <= lim.pulv_vento_max ? 'amarelo' : 'vermelho';
  const tomRaj: Tom = hh?.rajada == null ? 'neutro' : hh.rajada <= lim.pulv_vento_max * 1.3 ? 'verde' : hh.rajada <= lim.pulv_vento_max * 2 ? 'amarelo' : 'vermelho';
  const tomTemp: Tom = hh?.temp == null ? 'neutro' : hh.temp <= lim.pulv_temp_max - 4 ? 'verde' : hh.temp <= lim.pulv_temp_max ? 'amarelo' : 'vermelho';
  const tomUr: Tom =
    hh?.ur == null || op === 'plantio'
      ? 'neutro'
      : op === 'pulv'
        ? hh.ur >= lim.pulv_ur_min + 10 ? 'verde' : hh.ur >= lim.pulv_ur_min ? 'amarelo' : 'vermelho'
        : hh.ur <= lim.colheita_ur_max - 10 ? 'verde' : hh.ur <= lim.colheita_ur_max ? 'amarelo' : 'vermelho';

  const faixaTxt = d?.q10 != null && d?.q90 != null ? `${fmtMm(d.q10)}–${fmtMm(d.q90)} mm (P10–P90 do ensemble)` : `${fmtMm(d?.min)}–${fmtMm(d?.max)} mm (entre modelos)`;
  const n = (v: number | null | undefined, un = '') => (v == null ? '—' : `${Math.round(v)}${un}`);

  return (
    <>
      <div class={`banner b-${semOp.estado}`} role="status">
        <div class="bt">
          {TITULO[semOp.estado]} {info.verbo}
        </div>
        <div class="bs">
          {semOp.janela ? `Melhor janela ${fmtJanela(semOp.janela)} · ` : ''}
          {semOp.motivo}
        </div>
      </div>

      <div class="ops" role="group" aria-label="Operação">
        {OPS.map(({ id, nome, Ic }) => (
          <button class="op" aria-pressed={op === id} onClick={() => (operacao.value = id)}>
            <Ic size={22} />
            {nome}
          </button>
        ))}
      </div>

      <div class="escopo">
        <SeletorEscopo />
      </div>

      <div class="dia-rot">
        {ehHoje ? 'Hoje' : DIAS[new Date(dia + 'T12:00:00Z').getUTCDay()]} · {dia.slice(8, 10)}/{dia.slice(5, 7)} · {fmtHora(hora)}
        {ehHoje && hora === partesLocais(Date.now() / 1000, m.fuso).hora ? ' (agora)' : ''}
      </div>
      <div class="tiles">
        <Tile titulo="Chuva do dia" tom={tomChuva} valor={`${fmtMm(d?.provavel)} mm`} sub={`faixa ${fmtMm(d?.q10 ?? d?.min)}–${fmtMm(d?.q90 ?? d?.max)}`} />
        <Tile titulo="Sol" tom="sol" sub=" ">
          <div class="sun">
            <span>↑ {hhmm(m.nascer, m.fuso)}</span>
            <span>↓ {hhmm(m.por, m.fuso)}</span>
          </div>
        </Tile>
        <Tile titulo="Temperatura" tom={tomTemp} valor={n(hh?.temp, '°C')} sub={m.tMin != null ? `${Math.round(m.tMin)}–${Math.round(m.tMax!)} °C no dia` : ' '} />
        <Tile titulo="Vento" tom={tomVento} valor={n(hh?.vento, ' km/h')} sub={m.vMax != null ? `máx ${Math.round(m.vMax)} km/h` : ' '} />
        <Tile titulo="Rajadas" tom={tomRaj} valor={n(hh?.rajada, ' km/h')} sub="a 10 m" />
        <Tile titulo="Dir. do vento" tom="verde" sub={hh?.dir != null ? `vem de ${Math.round(hh.dir)}°` : ' '}>
          <Bussola dir={hh?.dir ?? null} />
        </Tile>
        <Tile titulo="Chance" tom={tomProb} valor={n(d?.prob, '%')} sub={d?.p10mm != null ? `≥10 mm: ${d.p10mm}%` : d?.probFonte === 'modelos' ? 'média dos modelos' : ' '} />
        <Tile titulo="Nuvens" tom="neutro" valor={n(hh?.nuvem, '%')} sub={hh?.mm != null ? `chuva ${fmtMm(hh.mm)} mm/h` : ' '} />
        <Tile titulo="Umidade" tom={tomUr} valor={n(hh?.ur, '%')} sub={op === 'pulv' ? `mín. ${lim.pulv_ur_min}%` : op === 'colheita' ? `máx. ${lim.colheita_ur_max}%` : ' '} />
        <Tile titulo="Medido" tom="neutro" valor={med != null ? `${fmtMm(med)} mm` : '—'} sub={med != null ? 'seu pluviômetro' : 'sem lançamento'} />
        <Tile titulo={ehHoje ? 'Ainda previsto' : 'Total previsto'} tom="neutro" valor={`${fmtMm(ehHoje ? m.restante : d?.provavel)} mm`} sub={ehHoje ? 'até o fim do dia' : 'no dia'} />
        <Tile titulo="Hora chuva" tom="neutro" valor={hp != null ? fmtHora(hp) : '—'} sub="hora mais provável" />
      </div>

      <div class="card tl">
        <div class="tlh">
          <b>Linha do tempo</b>
          <span class="muted">toque numa hora · verde = bom para {info.verbo}</span>
        </div>
        <div class="tlbar" role="group" aria-label="Horas do dia">
          {horasD.map((h: ValorHora, i) => {
            const oper = h.hora >= 6 && h.hora < 20;
            return (
              <button
                key={h.ts}
                class={`hr ${ok[i] ? 'hv' : 'hx'} ${oper ? '' : 'noite'} ${h.hora === hora ? 'sel' : ''}`}
                aria-label={`${fmtHora(h.hora)}: ${ok[i] ? 'adequado' : 'inadequado'}, chuva ${fmtMm(h.mm)} mm`}
                onClick={() => (horaSel.value = h.hora)}
              >
                <i style={`height:${Math.round(((h.mm ?? 0) / maxMm) * 100)}%`} />
              </button>
            );
          })}
        </div>
        <div class="ticks">
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <span>{String(h).padStart(2, '0')}</span>
          ))}
        </div>
      </div>

      <div class="faixa" role="group" aria-label="Próximos 14 dias">
        {faixa.map((f, i) => {
          const s = op === 'pulv' ? f.s.pulverizacao : op === 'plantio' ? f.s.plantio : f.s.colheita;
          return (
            <button class={`fd f-${s.estado} ${f.data === dia ? 'sel' : ''}`} key={f.data} onClick={() => ((diaSel.value = f.data), (horaSel.value = null))} aria-label={`${f.data}: ${s.estado}`}>
              <span>{i === 0 ? 'hoje' : DIAS[new Date(f.data + 'T12:00:00Z').getUTCDay()]}</span>
              <b>{f.data.slice(8, 10)}</b>
              <small>{fmtMm(f.mm)}</small>
            </button>
          );
        })}
      </div>

      <div class="card">
        <h2>Precisão desta previsão</h2>
        <div class="row sp">
          <div class="kv">
            <b>{fmtMm(d?.bruto)} mm</b>
            <span>bruto (média ponderada)</span>
          </div>
          <div class="kv">
            <b>{fmtMm(d?.provavel)} mm</b>
            <span>corrigido</span>
          </div>
          <div class="kv">
            <b>{d?.nModelos ?? 0}</b>
            <span>modelos neste dia</span>
          </div>
        </div>
        <div class="muted" style="margin-top:8px">Faixa: {faixaTxt}</div>
        <table style="margin-top:10px">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Previu</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            {MODELOS.filter((mm) => d?.porModelo[mm]).map((mm) => (
              <tr>
                <td>{NOME_MODELO[mm]}</td>
                <td>{fmtMm(d!.porModelo[mm]!.mm)} mm</td>
                <td>{pesos.pesos[mm].toFixed(2).replace('.', ',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="aviso">
          Pesos {pesos.calibrado ? (pesos.fonte === 'pluviometro' ? `aprendidos com o seu pluviômetro (${pesos.nDias} dias)` : `aprendidos no histórico de ${pesos.nDias} dias contra satélite/reanálise (não é pluviômetro)`) : 'iguais (sem histórico suficiente)'} para {dh <= 0 ? 'hoje' : `${dh} dia(s) à frente`}.{' '}
          {fc.ativo ? `Correção de viés ×${fc.fator.toFixed(2).replace('.', ',')} (${fc.nDias} dias de pluviômetro).` : `Sem correção de viés: calibrando (${fc.nDias} de 20 dias de pluviômetro).`} Chance = {d?.probFonte === 'ensemble' ? 'fração dos cenários do ensemble (6 sistemas, até 212 membros, cada sistema com o mesmo peso) com ≥ 1 mm' : 'média dos modelos'}. Grade ECMWF {g.grade.lat.toFixed(2)},{g.grade.lon.toFixed(2)}
          {t ? ` · ${t.nome}` : ` · grupo ${g.id}`}.
        </div>
        <div class="aviso">
          <IcAlerta size={14} /> Confirme sempre pela bula do produto e pelo receituário agronômico. <button class="lk" onClick={() => (aba.value = 'ajustes')}>Editar limites</button>
        </div>
      </div>
    </>
  );
}
