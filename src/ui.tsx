import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { concluirGuia, guiaAberto } from './state';
import { IconeClima } from './weather';

/** Folha que sobe de baixo com explicação; fecha tocando fora, no X ou com Esc. */
export function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  return (
    <div class="folha-fundo" onClick={onFechar}>
      <div class="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div class="folha-topo">
          <h3>{titulo}</h3>
          <button class="ib" aria-label="Fechar" onClick={onFechar}>
            ✕
          </button>
        </div>
        <div class="folha-corpo">{children}</div>
      </div>
    </div>
  );
}

/** Botão "?" que abre uma explicação em linguagem simples. */
export function Ajuda({ titulo, children }: { titulo: string; children: ComponentChildren }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button class="ajuda" aria-label={`O que é: ${titulo}`} onClick={() => setAberto(true)}>
        ?
      </button>
      {aberto && (
        <Folha titulo={titulo} onFechar={() => setAberto(false)}>
          {children}
        </Folha>
      )}
    </>
  );
}

const PASSOS = [
  { icone: 'forte' as const, titulo: 'Veja se vai chover', texto: 'Na tela inicial a frase grande diz se vai chover, quando e quanto. O desenho muda conforme o tempo.' },
  { icone: 'sol' as const, titulo: 'Veja se pode trabalhar', texto: 'Três cartões: Pulverização, Plantio e Colheita. Verde = PODE. Amarelo = CUIDADO. Vermelho = NÃO. Toque para saber o porquê.' },
  { icone: 'parcial' as const, titulo: 'Escolha o dia e ouça', texto: 'Toque num dia na faixa de cima para ver outro dia. O botão com o alto-falante lê a previsão em voz alta.' },
];

/** Guia de primeiro uso (3 telas). Pode ser reaberto em Mais > Como usar. */
export function Guia() {
  const [i, setI] = useState(0);
  if (!guiaAberto.value) return null;
  const p = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;
  return (
    <div class="guia" role="dialog" aria-modal="true" aria-label="Como usar o app">
      <div class="guia-card">
        <IconeClima tipo={p.icone} size={120} />
        <div class="guia-passo">
          Passo {i + 1} de {PASSOS.length}
        </div>
        <h2>{p.titulo}</h2>
        <p>{p.texto}</p>
        <div class="guia-pontos" aria-hidden="true">
          {PASSOS.map((_, k) => (
            <i class={k === i ? 'on' : ''} />
          ))}
        </div>
        <div class="row" style="justify-content:center;margin-top:16px">
          {!ultimo && (
            <button class="btn sec" onClick={concluirGuia}>
              Pular
            </button>
          )}
          <button class="btn grande" onClick={() => (ultimo ? concluirGuia() : setI(i + 1))}>
            {ultimo ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
