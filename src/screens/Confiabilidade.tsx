import { erros, status } from '../state';
import { fmtMm, fatorCorrecao } from '../../shared/calc';
import { NOME_MODELO, MODELOS } from '../../shared/tipos';
import type { ErroModelo, ModeloId } from '../../shared/tipos';
import { useState } from 'preact/hooks';

const HZ: [number, string][] = [[0, 'Hoje'], [1, '24 h'], [3, '3 dias'], [7, '7 dias']];

export function Confiabilidade() {
  const [janela, setJanela] = useState(90);
  const rows = erros.value.filter((e) => e.janela === janela);
  const fator = fatorCorrecao(erros.value);
  const nMax = Math.max(0, ...rows.filter((e) => e.modelo !== '_fator').map((e) => e.n_dias));
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <>
      <div class="card">
        <h2>Confiabilidade da previsão</h2>
        <div class="chips" role="group" aria-label="Janela">
          {[30, 90].map((j) => (
            <button class="chip" aria-pressed={janela === j} onClick={() => setJanela(j)}>
              Últimos {j} dias
            </button>
          ))}
        </div>
        <div class="muted">
          Compara o que cada modelo previu com a chuva <b>medida no seu pluviômetro</b>. Chuva ≥ 1 mm conta como "choveu".
        </div>
        {nMax < 20 && (
          <div class="aviso">
            <b>Ainda calibrando ({nMax} de 20 dias com medida).</b> Lance a chuva diariamente em “Medida”. Até lá, os modelos têm peso igual e não há correção de viés — os números abaixo são parciais e não devem ser tratados como definitivos.
          </div>
        )}
        {status.value.ts == null && <div class="aviso">Sem conexão com o servidor.</div>}
      </div>

      <div class="card">
        <h2>Correção de viés</h2>
        {fator.ativo ? (
          <div>
            Fator ×<b>{fator.fator.toFixed(2).replace('.', ',')}</b> aplicado (sustentado por {fator.nDias} dias com medida). O app mostra o número bruto e o corrigido.
          </div>
        ) : (
          <div class="muted">Inativa: precisa de 20 dias com medida e previsões gravadas (hoje {fator.nDias}).</div>
        )}
      </div>

      {HZ.map(([h, nome]) => {
        const r = rows.filter((e) => e.horizonte === h && e.modelo !== '_fator');
        return (
          <div class="card" key={h}>
            <h2>Horizonte: {nome}</h2>
            {r.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Erro médio</th>
                    <th>Viés</th>
                    <th>Acertou</th>
                    <th>Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {(MODELOS as string[]).map((m) => {
                    const e = r.find((x: ErroModelo) => x.modelo === m);
                    return (
                      <tr>
                        <td>{NOME_MODELO[m as ModeloId]}</td>
                        <td>{e ? `${fmtMm(e.mae)} mm` : '—'}</td>
                        <td>{e && e.vies != null ? `${e.vies > 0 ? '+' : ''}${fmtMm(e.vies)}` : '—'}</td>
                        <td>{e ? pct(e.acerto) : '—'}</td>
                        <td>{e ? e.n_dias : 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div class="muted">Ainda calibrando: sem dias com previsão e chuva medida neste horizonte.</div>
            )}
          </div>
        );
      })}
      <div class="muted" style="margin-bottom:12px">
        Viés &gt; 0: o modelo previu mais chuva do que choveu. “Acertou” = previu e choveu (≥ 1 mm) ou não previu e não choveu.
      </div>
    </>
  );
}
