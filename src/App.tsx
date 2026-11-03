import { useEffect } from 'preact/hooks';
import { aba, carregar, status, payload, online, lugar, statusLugar, abrirLugar, buscaAberta } from './state';
import type { Aba } from './state';
import { haMinutos } from './net';
import { IcAtualizar, IcBusca, IcCalendario, IcCompartilhar, IcEngrenagem, IcGota, IcGrade, IcGrafico, IcMapa, IcRegua, IcWifiOff } from './icons';
import { compartilharWhats } from './resumo';
import { Hoje } from './screens/Hoje';
import { payloadLugar } from './state';
const payloadLugarPronto = () => !!payloadLugar.value && payloadLugar.value.lugar.lat === lugar.value?.lat && payloadLugar.value.lugar.lon === lugar.value?.lon;
import { Semana } from './screens/Semana';
import { Talhoes } from './screens/Talhoes';
import { Mapa } from './screens/Mapa';
import { Medida } from './screens/Medida';
import { Confiabilidade } from './screens/Confiabilidade';
import { Ajustes } from './screens/Ajustes';
import { Buscar } from './screens/Buscar';

const ABAS: { id: Aba; nome: string; Ic: (p: { size?: number }) => any }[] = [
  { id: 'hoje', nome: 'Condições', Ic: IcGota },
  { id: 'semana', nome: 'Previsão', Ic: IcCalendario },
  { id: 'talhoes', nome: 'Talhões', Ic: IcGrade },
  { id: 'mapa', nome: 'Mapa', Ic: IcMapa },
  { id: 'medida', nome: 'Medida', Ic: IcRegua },
  { id: 'confiab', nome: 'Precisão', Ic: IcGrafico },
  { id: 'ajustes', nome: 'Ajustes', Ic: IcEngrenagem },
];

export function App() {
  useEffect(() => {
    carregar();
    const id = setInterval(() => carregar(), 30 * 60 * 1000);
    const volta = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', volta);
    window.addEventListener('online', volta);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', volta);
      window.removeEventListener('online', volta);
    };
  }, []);

  const s = { ...status.value, offline: status.value.offline || !online.value };
  const a = aba.value;
  return (
    <>
      <header class="top">
        <img src="/icon-192.png" alt="" />
        <h1>
          Chuva Pro
          <small>
            Lagoa Formosa ·{' '}
            {s.carregando && !payload.value
              ? 'carregando…'
              : s.offline
                ? `dados offline · salvo ${s.ts ? haMinutos(s.ts) : ''}`
                : s.ts
                  ? `atualizado ${haMinutos(s.ts)}`
                  : 'sem dados'}
          </small>
        </h1>
        {s.offline && (
          <span class="badge warn" role="status">
            <IcWifiOff size={16} /> offline
          </span>
        )}
        <button class={`ib ${lugar.value ? 'on' : ''}`} aria-label="Pesquisar outro local" onClick={() => (buscaAberta.value = true)}>
          <IcBusca />
        </button>
        <button class="ib" aria-label="Atualizar agora" onClick={() => (lugar.value ? abrirLugar(lugar.value, true) : carregar(true))} disabled={s.carregando || statusLugar.value.carregando}>
          <IcAtualizar />
        </button>
        <button class="ib" aria-label="Enviar resumo no WhatsApp" onClick={compartilharWhats}>
          <IcCompartilhar />
        </button>
      </header>
      <main>
        {lugar.value && statusLugar.value.carregando && !statusLugar.value.ts && (
          <div class="card" role="status">
            Calculando a previsão de <b>{lugar.value.nome}</b>… (busca o histórico de 90 dias do local, leva alguns segundos)
          </div>
        )}
        {lugar.value && statusLugar.value.erro && (
          <div class="err" role="alert">
            <b>{lugar.value.nome}:</b> {statusLugar.value.erro}
          </div>
        )}
        {s.erro && (
          <div class="err" role="alert">
            <b>Falha ao consultar:</b> {s.erro}
            {payload.value && <div class="muted">Mostrando o último dado salvo ({s.ts ? haMinutos(s.ts) : '—'}).</div>}
          </div>
        )}
        {lugar.value && a !== 'hoje' && a !== 'semana' && a !== 'ajustes' && (
          <div class="aviso" style="margin:0 0 10px">
            Você pesquisou <b>{lugar.value.nome}</b>; esta aba mostra a <b>Fazenda Lagoa Formosa</b>.{' '}
            <button class="lk" onClick={() => abrirLugar(null)}>Voltar para a fazenda</button>
          </div>
        )}
        {a === 'hoje' && (lugar.value && !payloadLugarPronto() ? null : <Hoje />)}
        {a === 'semana' && (lugar.value && !payloadLugarPronto() ? null : <Semana />)}
        {a === 'talhoes' && <Talhoes />}
        {a === 'mapa' && <Mapa />}
        {a === 'medida' && <Medida />}
        {a === 'confiab' && <Confiabilidade />}
        {a === 'ajustes' && <Ajustes />}
      </main>
      {buscaAberta.value && <Buscar />}
      <nav class="bar" aria-label="Seções">
        <div>
          {ABAS.map(({ id, nome, Ic }) => (
            <button key={id} aria-current={a === id} onClick={() => (aba.value = id)}>
              <Ic />
              {nome}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
