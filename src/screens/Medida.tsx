import { useMemo, useRef, useState } from 'preact/hooks';
import { carregar, historico, limites, medidas, payload, talhoes } from '../state';
import { enviar, FAZENDA } from '../net';
import { addDias, fmtDia, fmtMm, hojeLocal } from '../../shared/calc';
import { inicioSafra, medidoDia } from '../derive';
import { IcBaixar, IcCamera, IcLixeira } from '../icons';
import type { Medida as M } from '../../shared/tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function reduzirFoto(f: File): Promise<string> {
  const img = await createImageBitmap(f);
  const k = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}

export function baixar(nome: string, texto: string, tipo: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Medida() {
  const p = payload.value;
  const hoje = p ? hojeLocal(p.fazenda.fuso) : new Date().toISOString().slice(0, 10);
  const [tid, setTid] = useState('');
  const [data, setData] = useState(hoje);
  const [mm, setMm] = useState('');
  const [obs, setObs] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [env, setEnv] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  const ms = medidas.value;

  const salvar = async (e: Event) => {
    e.preventDefault();
    const v = Number(mm.replace(',', '.'));
    if (!isFinite(v) || v < 0 || v >= 500) return setMsg({ ok: false, t: 'Informe um valor de mm entre 0 e 500.' });
    setEnv(true);
    try {
      await enviar('/api/medidas', 'POST', { fazenda_id: FAZENDA, talhao_id: tid || null, data, mm: v, obs: obs || null, foto });
      setMsg({ ok: true, t: `Salvo: ${fmtMm(v)} mm em ${fmtDia(data)}.` });
      setMm('');
      setObs('');
      setFoto(null);
      await carregar(true);
    } catch (x) {
      setMsg({ ok: false, t: `Não salvou: ${(x as Error).message}. Verifique a conexão e tente de novo.` });
    } finally {
      setEnv(false);
    }
  };
  const apagar = async (id: string) => {
    if (!confirm('Apagar este lançamento?')) return;
    try {
      await enviar(`/api/medidas?id=${id}`, 'DELETE');
      await carregar(true);
    } catch (x) {
      setMsg({ ok: false, t: `Não apagou: ${(x as Error).message}` });
    }
  };

  const safraIni = inicioSafra(hoje, limites.value.safra_inicio);
  const resumo = useMemo(() => {
    const porMes = new Map<string, number>();
    const dias = new Set(ms.filter((m) => m.data >= safraIni).map((m) => m.data));
    for (const d of dias) {
      const v = medidoDia(ms, d, null) ?? 0;
      const k = d.slice(0, 7);
      porMes.set(k, (porMes.get(k) || 0) + v);
    }
    const porTalhao = talhoes.value.map((t) => {
      let s = 0;
      for (let d = safraIni; d <= hoje; d = addDias(d, 1)) s += medidoDia(ms, d, t.id) ?? 0;
      return { t, s };
    });
    return { porMes: [...porMes].sort(), total: [...porMes.values()].reduce((a, b) => a + b, 0), porTalhao: porTalhao.sort((a, b) => b.s - a.s) };
  }, [ms, talhoes.value, hoje]);

  const comp = useMemo(() => {
    const out: { data: string; prev: number | null; med: number | null }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDias(hoje, -i);
      out.push({ data: d, prev: historico.value.find((h) => h.data === d)?.prev ?? null, med: medidoDia(ms, d, null) });
    }
    return out;
  }, [ms, historico.value, hoje]);

  const csv = () => baixar(`chuva-medida-lagoa-formosa-${hoje}.csv`, 'data;talhao;mm;obs\n' + ms.map((m) => `${m.data};${talhoes.value.find((t) => t.id === m.talhao_id)?.nome ?? 'fazenda toda'};${String(m.mm).replace('.', ',')};${(m.obs || '').replace(/[;\n]/g, ' ')}`).join('\n'), 'text/csv;charset=utf-8');

  return (
    <>
      <form class="card" onSubmit={salvar}>
        <h2>Lançar chuva do pluviômetro</h2>
        <label for="lt">Onde</label>
        <select id="lt" value={tid} onChange={(e) => setTid((e.target as HTMLSelectElement).value)}>
          <option value="">Fazenda toda</option>
          {talhoes.value.map((t) => (
            <option value={t.id}>{t.nome}</option>
          ))}
        </select>
        <div class="grid2">
          <div>
            <label for="ld">Data</label>
            <input id="ld" type="date" value={data} max={hoje} onInput={(e) => setData((e.target as HTMLInputElement).value)} required />
          </div>
          <div>
            <label for="lm">Chuva (mm)</label>
            <input id="lm" inputMode="decimal" placeholder="0,0" value={mm} onInput={(e) => setMm((e.target as HTMLInputElement).value)} required />
          </div>
        </div>
        <label for="lo">Observação</label>
        <input id="lo" value={obs} onInput={(e) => setObs((e.target as HTMLInputElement).value)} maxLength={200} />
        <div class="row" style="margin-top:12px">
          <input ref={arq} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setFoto(await reduzirFoto(f)); }} />
          <button type="button" class="btn sec" onClick={() => arq.current?.click()}>
            <IcCamera /> {foto ? 'Foto anexada' : 'Foto'}
          </button>
          <button class="btn" style="flex:1" disabled={env}>
            {env ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
        {msg && (
          <div class={`aviso`} role="status" style={`border-color:${msg.ok ? 'var(--ok)' : 'var(--ver)'}`}>
            {msg.t}
          </div>
        )}
      </form>

      <div class="card">
        <h2>Acumulado da safra (desde {fmtDia(safraIni)})</h2>
        <div class="big" style="font-size:36px">
          {fmtMm(resumo.total)}
          <small>mm</small>
        </div>
        <table style="margin-top:10px">
          <tbody>
            {resumo.porMes.map(([k, v]) => (
              <tr>
                <td>{MESES[Number(k.slice(5)) - 1]}/{k.slice(2, 4)}</td>
                <td>{fmtMm(v)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!resumo.porMes.length && <div class="muted">Nenhuma chuva lançada nesta safra.</div>}
        <h2 style="margin-top:16px">Por talhão</h2>
        <table>
          <tbody>
            {resumo.porTalhao.map(({ t, s }) => (
              <tr>
                <td>{t.nome}</td>
                <td>{fmtMm(s)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Previsto × medido (14 dias)</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Previsto (D-1)</th>
              <th>Medido</th>
            </tr>
          </thead>
          <tbody>
            {comp.map((r) => (
              <tr>
                <td>{fmtDia(r.data)}</td>
                <td>{r.prev == null ? '—' : fmtMm(r.prev)}</td>
                <td>{r.med == null ? '—' : fmtMm(r.med)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="aviso">“—” = sem registro. O previsto de D-1 só existe a partir do dia em que o app começou a gravar previsões.</div>
      </div>

      <div class="card">
        <h2>Lançamentos recentes</h2>
        {ms.slice(0, 30).map((m: M) => (
          <div class="tal" style="cursor:default" key={m.id}>
            <div class="n">
              <b>{fmtMm(m.mm)} mm</b>
              <small>
                {fmtDia(m.data)} · {talhoes.value.find((t) => t.id === m.talhao_id)?.nome ?? 'fazenda toda'}
                {m.obs ? ` · ${m.obs}` : ''}
              </small>
            </div>
            <button class="ib" aria-label="Apagar lançamento" onClick={() => apagar(m.id)}>
              <IcLixeira />
            </button>
          </div>
        ))}
        {!ms.length && <div class="muted">Nenhum lançamento ainda.</div>}
        <div class="row" style="margin-top:12px">
          <button class="btn sec" onClick={csv} disabled={!ms.length}>
            <IcBaixar /> Exportar CSV
          </button>
        </div>
      </div>
    </>
  );
}
