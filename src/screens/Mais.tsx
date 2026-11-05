import { aba, buscaAberta, definirFonte, definirModo, definirTema, fonte, guiaAberto, instalarEvt, modo, tema } from '../state';
import { IcAjuda, IcBusca, IcEngrenagem, IcGrade, IcGrafico } from '../icons';

const Linha = ({ ic, titulo, sub, onClick }: { ic: any; titulo: string; sub: string; onClick: () => void }) => (
  <button class="linha" onClick={onClick}>
    <span class="linha-ic">{ic}</span>
    <span class="linha-t">
      <b>{titulo}</b>
      <small>{sub}</small>
    </span>
    <span aria-hidden="true">›</span>
  </button>
);

function Opcoes<T extends string>({ valor, itens, onMudar, rotulo }: { valor: T; itens: [T, string][]; onMudar: (v: T) => void; rotulo: string }) {
  return (
    <div class="seg" role="group" aria-label={rotulo}>
      {itens.map(([v, nome]) => (
        <button key={v} aria-pressed={valor === v} onClick={() => onMudar(v)}>
          {nome}
        </button>
      ))}
    </div>
  );
}

export function Mais() {
  return (
    <>
      <div class="card">
        <h2>Ver o app</h2>
        <label>Modo</label>
        <Opcoes rotulo="Modo" valor={modo.value} onMudar={definirModo} itens={[['simples', 'Simples'], ['tecnico', 'Técnico']]} />
        <label>Cores</label>
        <Opcoes rotulo="Cores" valor={tema.value} onMudar={definirTema} itens={[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']]} />
        <label>Tamanho das letras</label>
        <Opcoes rotulo="Tamanho das letras" valor={fonte.value} onMudar={definirFonte} itens={[['normal', 'Normal'], ['grande', 'Grande'], ['extra', 'Extra grande']]} />
        <div class="muted" style="margin-top:8px">Automático segue o claro/escuro do seu celular. O claro é melhor para ler sob o sol.</div>
      </div>
      <div class="card">
        <Linha ic={<IcBusca />} titulo="Pesquisar outro local" sub="Cidade, estado, coordenadas ou GPS" onClick={() => (buscaAberta.value = true)} />
        <Linha ic={<IcGrade />} titulo="Talhões" sub="Chuva em cada talhão da fazenda" onClick={() => (aba.value = 'talhoes')} />
        <Linha ic={<IcGrafico />} titulo="Precisão da previsão" sub="Quanto cada modelo acerta" onClick={() => (aba.value = 'confiab')} />
        <Linha ic={<IcEngrenagem />} titulo="Ajustes" sub="Limites, notificações, KML e backup" onClick={() => (aba.value = 'ajustes')} />
        <Linha ic={<IcAjuda />} titulo="Como usar" sub="Guia rápido de 3 passos" onClick={() => (guiaAberto.value = true)} />
      </div>
      {instalarEvt.value && (
        <div class="card">
          <h2>Instalar no celular</h2>
          <div class="muted">Coloque o app na tela inicial: abre mais rápido e funciona até sem sinal (mostra o último dado salvo).</div>
          <button
            class="btn grande full"
            style="margin-top:10px"
            onClick={async () => {
              const e = instalarEvt.value;
              e.prompt();
              await e.userChoice.catch(() => null);
              instalarEvt.value = null;
            }}
          >
            Instalar o app
          </button>
        </div>
      )}
    </>
  );
}
