import { useEffect } from 'preact/hooks';
import { aba, carregar, status, payload } from './state';
import type { Aba } from './state';
import { haMinutos } from './net';
import { IcAtualizar, IcCalendario, IcEngrenagem, IcGota, IcGrade, IcGrafico, IcMapa, IcRegua, IcWifiOff } from './icons';
import { Hoje } from './screens/Hoje';
import { Semana } from './screens/Semana';
import { Talhoes } from './screens/Talhoes';
import { Mapa } from './screens/Mapa';
import { Medida } from './screens/Medida';
import { Confiabilidade } from './screens/Confiabilidade';
import { Ajustes } from './screens/Ajustes';

const ABAS: { id: Aba; nome: string; Ic: (p: { size?: number }) => any }[] = [
  { id: 'hoje', nome: 'Hoje', Ic: IcGota },
  { id: 'semana', nome: 'Semana', Ic: IcCalendario },
  { id: 'talhoes', nome: 'Talhões', Ic: IcGrade },
  { id: 'mapa', nome: 'Mapa', Ic: IcMapa },
  { id: 'medida', nome: 'Medida', Ic: IcRegua },
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

  const s = status.value;
  const a = aba.value;
  return (
    <>
      <header class="top">
        <h1>
          Lagoa Formosa
          <small>
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
        <button class="ib" aria-label="Atualizar agora" onClick={() => carregar(true)} disabled={s.carregando}>
          <IcAtualizar />
        </button>
        <button class={`ib ${a === 'confiab' ? 'on' : ''}`} aria-label="Confiabilidade" onClick={() => (aba.value = 'confiab')}>
          <IcGrafico />
        </button>
        <button class={`ib ${a === 'ajustes' ? 'on' : ''}`} aria-label="Ajustes" onClick={() => (aba.value = 'ajustes')}>
          <IcEngrenagem />
        </button>
      </header>
      <main>
        {s.erro && (
          <div class="err" role="alert">
            <b>Falha ao consultar:</b> {s.erro}
            {payload.value && <div class="muted">Mostrando o último dado salvo ({s.ts ? haMinutos(s.ts) : '—'}).</div>}
          </div>
        )}
        {a === 'hoje' && <Hoje />}
        {a === 'semana' && <Semana />}
        {a === 'talhoes' && <Talhoes />}
        {a === 'mapa' && <Mapa />}
        {a === 'medida' && <Medida />}
        {a === 'confiab' && <Confiabilidade />}
        {a === 'ajustes' && <Ajustes />}
      </main>
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
