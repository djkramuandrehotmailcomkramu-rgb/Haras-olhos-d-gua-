import { useMemo, useState } from 'preact/hooks';
import { agora, definirModo, diaSel, horaSel, limites } from '../state';
import { Carregando, LugarChip, SeletorEscopo, useVisao } from './comum';
import { addDias, fatorCorrecao, fmtMm, horasOk, medidoDia, partesLocais, semaforos } from '../_ponte';
import { IconeClima, IconeVento } from '../weather';
import { Ajuda, Folha } from '../ui';
import { IcColheita, IcCompartilhar, IcSemente, IcSpray } from '../icons';
import { classeChuva, CLASSES, confianca, fraseTrabalho, iconeDia, NOME_OP, periodos, REGRA_OP, resumoDia, textoFalado } from '../../shared/texto';
import type { Operacao, ValorHora } from '../../shared/calc';
import { falar, temVoz } from '../voz';
import { compartilharWhats } from '../resumo';
import { medidoPeriodo } from '../derive';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const OPS: { id: Operacao; Ic: (p: { size?: number }) => any }[] = [
  { id: 'pulv', Ic: IcSpray },
  { id: 'plantio', Ic: IcSemente },
  { id: 'colheita', Ic: IcColheita },
];
const palavraVento = (v: number | null) => (v == null ? '—' : v < 12 ? 'fraco' : v < 20 ? 'moderado' : v < 30 ? 'forte' : 'muito forte');
const palavraUr = (v: number | null) => (v == null ? '—' : v < 40 ? 'muito seco' : v < 60 ? 'seco' : v < 80 ? 'normal' : 'úmido');

export function Simples() {
  const x = useVisao();
  const lim = limites.value;
  const [falando, setFalando] = useState(false);
  const [aberta, setAberta] = useState<Operacao | null>(null);
  const [ajudaEscala, setAjudaEscala] = useState(false);
  void agora.value; // re-render a cada batida do relógio (30 s): a "hora atual" acompanha sem recarregar

  const m = useMemo(() => {
    if (!x) return null;
    const { v, hoje, tid, ms } = x;
    const fuso = x.p.fazenda.fuso;
    const agoraTs = Date.now() / 1000;
    const horaAgora = partesLocais(agoraTs, fuso).hora;
    const dia = diaSel.value && v.dias.some((d) => d.data === diaSel.value) ? (diaSel.value as string) : hoje;
    const ehHoje = dia === hoje;
    const horasD = v.horas.filter((h) => h.data === dia);
    const d = v.dias.find((q) => q.data === dia);
    const dh = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86400000);
    const med3 = ms.length ? medidoPeriodo(ms, addDias(dia, -3), addDias(dia, -1), tid) : null;
    const considerar = ehHoje ? horasD.filter((h) => h.ts + 3600 > agoraTs) : horasD;
    const sem = semaforos(considerar, d?.provavel ?? null, med3, lim);
    const resumo = resumoDia(d, horasD, ehHoje, horaAgora);
    const conf = confianca(d, dh);
    const hAgora = ehHoje ? horasD.find((h) => h.hora === horaAgora) ?? null : horasD.find((h) => h.hora === 12) ?? null;
    const faixa = v.dias
      .filter((q) => q.data >= hoje)
      .slice(0, 7)
      .map((q) => {
        const hs = v.horas.filter((h) => h.data === q.data);
        const nv = hs.map((h) => h.nuvem).filter((n): n is number => n != null);
        return { data: q.data, mm: q.provavel, icone: iconeDia(q.provavel, nv.length ? nv.reduce((a, b) => a + b, 0) / nv.length : null, Math.max(0, ...hs.map((h) => h.rajada ?? 0))) };
      });
    return { dia, ehHoje, horasD, considerar, d, sem, resumo, conf, hAgora, horaAgora, faixa, dh };
  }, [x?.p.gerado_em, x?.tid, x?.ms, lim, x?.erros, diaSel.value, Math.floor(Date.now() / 600000)]);

  if (!x || !m) return <Carregando />;
  const { dia, ehHoje, horasD, considerar, d, sem, resumo, conf, hAgora, faixa } = m;
  const rotulo = ehHoje ? 'Hoje' : `${DIAS[new Date(dia + 'T12:00:00Z').getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const semOp = (op: Operacao) => (op === 'pulv' ? sem.pulverizacao : op === 'plantio' ? sem.plantio : sem.colheita);
  const trabalho = OPS.map(({ id }) => ({ id, nome: NOME_OP[id], s: semOp(id), f: fraseTrabalho(id, semOp(id), considerar, lim) }));
  const per = periodos(horasD);
  const fc = fatorCorrecao(x.erros);

  const ouvir = () => {
    const ok = falar(textoFalado({ quando: ehHoje ? 'Hoje' : rotulo, resumo, trabalho: trabalho.map((t) => ({ nome: t.nome, f: t.f })), conf }), () => setFalando(false));
    setFalando(ok && !falando);
  };

  const det = aberta ? trabalho.find((t) => t.id === aberta)! : null;
  const hh: ValorHora | null = hAgora;

  return (
    <>
      <div class="seg" role="group" aria-label="Modo de exibição">
        <button aria-pressed="true">Simples</button>
        <button aria-pressed="false" onClick={() => definirModo('tecnico')}>
          Técnico
        </button>
      </div>
      <LugarChip />
      <div class="dias" role="group" aria-label="Escolha o dia">
        {faixa.map((f, i) => (
          <button class={`dia-b ${f.data === dia ? 'sel' : ''}`} key={f.data} onClick={() => ((diaSel.value = f.data), (horaSel.value = null))} aria-label={`${i === 0 ? 'Hoje' : CURTO[new Date(f.data + 'T12:00:00Z').getUTCDay()]}, ${fmtMm(f.mm)} mm`}>
            <span>{i === 0 ? 'Hoje' : CURTO[new Date(f.data + 'T12:00:00Z').getUTCDay()]}</span>
            <IconeClima tipo={f.icone} size={38} />
            <small style={`color:${classeChuva(f.mm).cor}`}>{(f.mm ?? 0) < 0.2 ? 'seco' : `${fmtMm(f.mm)} mm`}</small>
          </button>
        ))}
      </div>

      <div class={`heroi c${resumo.classe.id}`} role="status">
        <IconeClima tipo={resumo.icone} size={110} titulo={resumo.titulo} />
        <div class="heroi-txt">
          <div class="heroi-dia">{rotulo}</div>
          <div class="heroi-tit">{resumo.titulo}</div>
          <div class="heroi-sub">{resumo.sub}</div>
        </div>
      </div>

      <div class="acoes">
        {temVoz() && (
          <button class="btn grande" onClick={ouvir} aria-pressed={falando}>
            {falando ? '■ Parar' : '🔊 Ouvir a previsão'}
          </button>
        )}
        <button class="btn sec grande" onClick={compartilharWhats} aria-label="Enviar resumo no WhatsApp">
          <IcCompartilhar /> WhatsApp
        </button>
      </div>

      <h2 class="sec-t">Posso trabalhar {ehHoje ? 'hoje' : 'neste dia'}?</h2>
      {trabalho.map(({ id, nome, s, f }) => {
        const Ic = OPS.find((o) => o.id === id)!.Ic;
        return (
          <button class={`trab t-${s.estado}`} key={id} onClick={() => setAberta(id)}>
            <span class="trab-ic">
              <Ic size={34} />
            </span>
            <span class="trab-txt">
              <b>{nome}</b>
              <span>{f.frase}</span>
            </span>
            <span class="trab-pal">{f.palavra}</span>
          </button>
        );
      })}
      <div class="muted" style="margin:2px 2px 14px">Toque num cartão para saber o porquê. Confirme sempre pela bula e pelo receituário.</div>

      {hh && (
        <div class="card">
          <h2>{ehHoje ? `Agora (${String(m.horaAgora).padStart(2, '0')}h)` : 'Por volta do meio-dia'}</h2>
          <div class="agora">
            <div>
              <b>{hh.temp != null ? `${Math.round(hh.temp)}°C` : '—'}</b>
              <span>temperatura</span>
            </div>
            <div>
              <b>
                <IconeVento size={22} /> {hh.vento != null ? Math.round(hh.vento) : '—'}
                <small> km/h</small>
              </b>
              <span>vento {palavraVento(hh.vento)}</span>
            </div>
            <div>
              <b>{hh.ur != null ? `${Math.round(hh.ur)}%` : '—'}</b>
              <span>ar {palavraUr(hh.ur)}</span>
            </div>
          </div>
        </div>
      )}

      <div class="card">
        <h2>Como o dia vai ser</h2>
        <div class="per">
          {per.map((p) => {
            const nv = horasD.filter((h) => h.hora >= p.ini && h.hora < p.fim).map((h) => h.nuvem).filter((n): n is number => n != null);
            const ic = iconeDia(p.mm, nv.length ? nv.reduce((a, b) => a + b, 0) / nv.length : null, null);
            const c = classeChuva(p.mm);
            return (
              <div class="per-b" key={p.nome}>
                <b>{p.nome}</b>
                <IconeClima tipo={ic} size={52} />
                <span style={`color:${c.cor};font-weight:700`}>{p.mm < 0.2 ? 'Seco' : c.nome.split(' / ')[0]}</span>
                <small>{p.mm < 0.2 ? ' ' : `${fmtMm(p.mm)} mm`}</small>
              </div>
            );
          })}
        </div>
      </div>

      <div class="card">
        <div class="row sp">
          <h2 style="margin:0">Confiança da previsão</h2>
          <Ajuda titulo="O que é a confiança?">
            <p>Mostra o quanto dá para confiar nesta previsão. Usamos vários modelos de previsão do tempo do mundo todo e comparamos. Quando quase todos dizem a mesma coisa, a confiança é <b>alta</b>. Quando discordam, é <b>baixa</b> — nesse caso, olhe a previsão de novo mais tarde.</p>
            <p>Previsões para daqui a muitos dias são sempre mais incertas.</p>
          </Ajuda>
        </div>
        <div class={`conf conf-${conf.nivel}`}>
          <span class="conf-barras" aria-hidden="true">
            <i class="on" />
            <i class={conf.nivel !== 'baixa' ? 'on' : ''} />
            <i class={conf.nivel === 'alta' ? 'on' : ''} />
          </span>
          <b>{conf.nome}</b>
        </div>
        <div class="muted">{conf.motivo[0].toUpperCase() + conf.motivo.slice(1)}</div>
        <div class="muted" style="margin-top:6px">
          Chance de chuva: <b>{d?.prob != null ? `${Math.round(d.prob)}%` : '—'}</b>
          {d?.q10 != null && d?.q90 != null ? ` · quantidade provável: de ${fmtMm(d.q10)} a ${fmtMm(d.q90)} mm` : ''}
        </div>
        {!x.lugar && !fc.ativo && <div class="muted" style="margin-top:6px">Lance a chuva do pluviômetro todos os dias (aba Medida) para a previsão ficar ainda mais ajustada à fazenda.</div>}
      </div>

      <div class="card">
        <div class="row sp">
          <h2 style="margin:0">Quanto é "1 mm" de chuva?</h2>
          <button class="lk" onClick={() => setAjudaEscala(true)}>
            Ver escala
          </button>
        </div>
        <div class="muted">1 mm = 1 litro de água em cada metro quadrado. Hoje: <b>{classeChuva(d?.provavel).nome}</b>.</div>
      </div>
      {ajudaEscala && (
        <Folha titulo="Escala da chuva (no dia)" onFechar={() => setAjudaEscala(false)}>
          <p>1 mm de chuva = 1 litro de água em cada metro quadrado de chão.</p>
          {CLASSES.map((c, i) => (
            <div class="esc" key={c.id}>
              <span class="esc-cor" style={`background:${c.cor}`} />
              <div>
                <b>{c.nome}</b> <span class="muted">{['menos de 0,2 mm', '0,2 a 2 mm', '2 a 10 mm', '10 a 25 mm', '25 a 50 mm', 'mais de 50 mm'][i]}</span>
                <div class="muted">{c.explica}</div>
              </div>
            </div>
          ))}
        </Folha>
      )}

      {!x.lugar && (
        <div class="card">
          <h2>Ver outro lugar da fazenda</h2>
          <SeletorEscopo />
        </div>
      )}

      {det && (
        <Folha titulo={`${det.nome}: ${det.f.palavra}`} onFechar={() => setAberta(null)}>
          <div class={`folha-estado t-${det.s.estado}`}>
            <b>{det.f.palavra}</b> — {det.f.frase}
          </div>
          <p>{REGRA_OP(det.id, lim)}</p>
          {hh && (
            <table>
              <thead>
                <tr>
                  <th>{ehHoje ? 'Agora' : 'Meio-dia'}</th>
                  <th>Valor</th>
                  <th>Limite</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {det.id === 'pulv' && (
                  <>
                    <tr><td>Vento</td><td>{hh.vento != null ? `${Math.round(hh.vento)} km/h` : '—'}</td><td>até {lim.pulv_vento_max}</td><td>{hh.vento == null ? '' : hh.vento <= lim.pulv_vento_max ? '✓' : '✗'}</td></tr>
                    <tr><td>Temperatura</td><td>{hh.temp != null ? `${Math.round(hh.temp)} °C` : '—'}</td><td>até {lim.pulv_temp_max}</td><td>{hh.temp == null ? '' : hh.temp <= lim.pulv_temp_max ? '✓' : '✗'}</td></tr>
                    <tr><td>Umidade do ar</td><td>{hh.ur != null ? `${Math.round(hh.ur)}%` : '—'}</td><td>mín. {lim.pulv_ur_min}</td><td>{hh.ur == null ? '' : hh.ur >= lim.pulv_ur_min ? '✓' : '✗'}</td></tr>
                  </>
                )}
                {det.id === 'colheita' && <tr><td>Umidade do ar</td><td>{hh.ur != null ? `${Math.round(hh.ur)}%` : '—'}</td><td>até {lim.colheita_ur_max}</td><td>{hh.ur == null ? '' : hh.ur <= lim.colheita_ur_max ? '✓' : '✗'}</td></tr>}
                <tr><td>Chuva na hora</td><td>{fmtMm(hh.mm)} mm</td><td>{det.id === 'plantio' ? 'até 2' : `até ${String(det.id === 'pulv' ? lim.pulv_chuva_max : lim.colheita_chuva_max).replace('.', ',')}`}</td><td>{(hh.mm ?? 0) <= (det.id === 'plantio' ? 2 : det.id === 'pulv' ? lim.pulv_chuva_max : lim.colheita_chuva_max) ? '✓' : '✗'}</td></tr>
              </tbody>
            </table>
          )}
          <div class="muted">Hora a hora (verde = bom): </div>
          <div class="tlbar mini" aria-hidden="true">
            {horasD.map((h, i) => {
              const okk = horasOk(det.id, horasD, lim)[i];
              return <span key={h.ts} class={`hr ${okk ? 'hv' : 'hx'} ${h.hora >= 6 && h.hora < 20 ? '' : 'noite'}`} />;
            })}
          </div>
          <div class="ticks"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span></div>
          <div class="aviso">Os limites podem ser mudados em Mais &gt; Ajustes. Confirme sempre na bula do produto e no receituário agronômico.</div>
        </Folha>
      )}
    </>
  );
}
