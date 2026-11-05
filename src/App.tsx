import { useEffect, useRef, useState } from 'preact/hooks';
import { aba, abrirGuia, agora, atualizarTudo, aplicarPreferencias, buscaAberta, guiaVisto, lugar, modo, online, payload, payloadLugar, abrirLugar, status, statusLugar } from './state';
import type { Aba } from './state';
import { haMinutos } from './net';
import { IcAtualizar, IcBusca, IcCalendario, IcGota, IcMais, IcMapa, IcRegua, IcWifiOff } from './icons';
import { Hoje } from './screens/Hoje';
import { Simples } from './screens/Simples';
import { Semana } from './screens/Semana';
import { Talhoes } from './screens/Talhoes';
import { Mapa } from './screens/Mapa';
import { Medida } from './screens/Medida';
import { Confiabilidade } from './screens/Confiabilidade';
import { Ajustes } from './screens/Ajustes';
import { Buscar } from './screens/Buscar';
import { Mais } from './screens/Mais';
import { Guia } from './ui';

const ABAS: { id: Aba; nome: string; Ic: (p: { size?: number }) => any }[] = [
  { id: 'hoje', nome: 'Hoje', Ic: IcGota },
  { id: 'semana', nome: 'Semana', Ic: IcCalendario },
  { id: 'mapa', nome: 'Mapa', Ic: IcMapa },
  { id: 'medida', nome: 'Medida', Ic: IcRegua },
  { id: 'mais', nome: 'Mais', Ic: IcMais },
];
const SUB_MAIS: Aba[] = ['talhoes', 'confiab', 'ajustes'];
const TITULO: Partial<Record<Aba, string>> = { talhoes: 'Talhões', confiab: 'Precisão da previsão', ajustes: 'Ajustes' };

const lugarPronto = () => !!payloadLugar.value && payloadLugar.value.lugar.lat === lugar.value?.lat && payloadLugar.value.lugar.lon === lugar.value?.lon;

export function App() {
  const [puxando, setPuxando] = useState(0);
  const y0 = useRef<number | null>(null);

  useEffect(() => {
    aplicarPreferencias();
    if (!guiaVisto.value) abrirGuia();
    atualizarTudo();
    const dado = setInterval(() => atualizarTudo(), 5 * 60 * 1000); // dado novo a cada 5 min com o app aberto
    const relogio = setInterval(() => (agora.value = Date.now()), 30 * 1000); // "há X min" e hora atual andam sozinhos
    const volta = () => document.visibilityState === 'visible' && atualizarTudo();
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    mq?.addEventListener?.('change', aplicarPreferencias);
    document.addEventListener('visibilitychange', volta);
    window.addEventListener('online', volta);
    window.addEventListener('focus', volta);
    return () => {
      clearInterval(dado);
      clearInterval(relogio);
      mq?.removeEventListener?.('change', aplicarPreferencias);
      document.removeEventListener('visibilitychange', volta);
      window.removeEventListener('online', volta);
      window.removeEventListener('focus', volta);
    };
  }, []);

  const noMapa = aba.value === 'mapa';
  useEffect(() => {
    document.body.classList.toggle('sem-zoom', noMapa);
  }, [noMapa]);

  // puxar a tela para baixo para atualizar
  const ini = (e: TouchEvent) => {
    if (window.scrollY <= 0 && !noMapa) y0.current = e.touches[0].clientY;
  };
  const mov = (e: TouchEvent) => {
    if (y0.current == null) return;
    const dy = e.touches[0].clientY - y0.current;
    setPuxando(dy > 0 ? Math.min(dy, 120) : 0);
  };
  const fim = () => {
    if (puxando > 80) atualizarTudo(true);
    y0.current = null;
    setPuxando(0);
  };

  const s = { ...status.value, offline: status.value.offline || !online.value };
  const a = aba.value;
  const tsAtivo = lugar.value ? statusLugar.value.ts : s.ts;
  const idade = tsAtivo ? (agora.value - tsAtivo) / 60000 : null;
  const carregando = s.carregando || statusLugar.value.carregando;
  const ativa: Aba = SUB_MAIS.includes(a) ? 'mais' : a;

  return (
    <div onTouchStart={ini as any} onTouchMove={mov as any} onTouchEnd={fim}>
      <header class="top">
        <img src="/icon-192.png" alt="" />
        <h1>
          Chuva Pro
          <small>{lugar.value ? lugar.value.nome : 'Lagoa Formosa'}</small>
        </h1>
        <button class={`ib ${lugar.value ? 'on' : ''}`} aria-label="Pesquisar outro local" onClick={() => (buscaAberta.value = true)}>
          <IcBusca />
        </button>
        <button class="ib" aria-label="Atualizar agora" onClick={() => atualizarTudo(true)} disabled={carregando}>
          <span class={carregando ? 'gira' : ''} style="display:grid">
            <IcAtualizar />
          </span>
        </button>
      </header>
      <div class={`vivo ${s.offline ? 'v-off' : idade != null && idade > 30 ? 'v-vel' : 'v-ok'}`} role="status" aria-live="polite">
        {s.offline ? (
          <>
            <IcWifiOff size={15} /> Sem sinal · mostrando o último dado salvo {tsAtivo ? haMinutos(tsAtivo) : ''}
          </>
        ) : carregando && !tsAtivo ? (
          'Carregando a previsão…'
        ) : carregando ? (
          <>
            <i class="ponto" /> Atualizando…
          </>
        ) : tsAtivo ? (
          <>
            <i class="ponto" /> {idade != null && idade > 30 ? 'Dado antigo' : 'Ao vivo'} · atualizado {haMinutos(tsAtivo)}
          </>
        ) : (
          'Sem dados'
        )}
      </div>
      <div class="ptr" style={`height:${puxando}px`} aria-hidden="true">
        {puxando > 80 ? 'Solte para atualizar' : puxando > 8 ? 'Puxe para atualizar' : ''}
      </div>
      <main>
        {SUB_MAIS.includes(a) && (
          <div class="voltar-linha">
            <button class="voltar" onClick={() => (aba.value = 'mais')}>
              ‹ Voltar
            </button>
            <b>{TITULO[a]}</b>
          </div>
        )}
        {lugar.value && statusLugar.value.carregando && !statusLugar.value.ts && (
          <div class="card" role="status">
            Calculando a previsão de <b>{lugar.value.nome}</b>… (busca o histórico de 90 dias do local; leva alguns segundos)
          </div>
        )}
        {lugar.value && statusLugar.value.erro && (
          <div class="err" role="alert">
            <b>{lugar.value.nome}:</b> {statusLugar.value.erro}
          </div>
        )}
        {s.erro && (
          <div class="err" role="alert">
            <b>Não consegui atualizar:</b> {s.erro}
            {payload.value && <div class="muted">Mostrando o último dado salvo ({s.ts ? haMinutos(s.ts) : '—'}).</div>}
          </div>
        )}
        {lugar.value && a !== 'hoje' && a !== 'semana' && a !== 'mais' && a !== 'ajustes' && (
          <div class="aviso" style="margin:0 0 10px">
            Você pesquisou <b>{lugar.value.nome}</b>; esta aba mostra a <b>Fazenda Lagoa Formosa</b>.{' '}
            <button class="lk" onClick={() => abrirLugar(null)}>
              Voltar para a fazenda
            </button>
          </div>
        )}
        {a === 'hoje' && (lugar.value && !lugarPronto() ? null : modo.value === 'simples' ? <Simples /> : <Hoje />)}
        {a === 'semana' && (lugar.value && !lugarPronto() ? null : <Semana />)}
        {a === 'talhoes' && <Talhoes />}
        {a === 'mapa' && <Mapa />}
        {a === 'medida' && <Medida />}
        {a === 'confiab' && <Confiabilidade />}
        {a === 'ajustes' && <Ajustes />}
        {a === 'mais' && <Mais />}
      </main>
      {buscaAberta.value && <Buscar />}
      <Guia />
      <nav class="bar" aria-label="Seções">
        <div>
          {ABAS.map(({ id, nome, Ic }) => (
            <button key={id} aria-current={ativa === id} onClick={() => (aba.value = id)}>
              <Ic size={26} />
              {nome}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
