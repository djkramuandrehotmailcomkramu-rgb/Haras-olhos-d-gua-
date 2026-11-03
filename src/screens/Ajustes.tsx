import { useRef, useState } from 'preact/hooks';
import { carregar, limites, medidas, talhoes } from '../state';
import { enviar, FAZENDA } from '../net';
import { LIMITES_PADRAO } from '../../shared/tipos';
import type { Limites } from '../../shared/tipos';
import { baixar } from './Medida';
import { IcBaixar, IcSino } from '../icons';

const CAMPOS: [keyof Limites, string, string][] = [
  ['pulv_vento_max', 'Pulverização: vento máx.', 'km/h'],
  ['pulv_temp_max', 'Pulverização: temperatura máx.', '°C'],
  ['pulv_ur_min', 'Pulverização: umidade mín.', '%'],
  ['pulv_chuva_max', 'Pulverização: chuva máx. por hora', 'mm'],
  ['plantio_dia_max', 'Plantio: chuva máx. no dia', 'mm'],
  ['plantio_acum_max', 'Plantio: chuva medida máx. em 3 dias', 'mm'],
  ['colheita_chuva_max', 'Colheita: chuva máx. por hora', 'mm'],
  ['colheita_ur_max', 'Colheita: umidade máx. do ar', '%'],
  ['janela_min_h', 'Janela mínima para “liberado”', 'h'],
  ['agrupamento_km', 'Agrupar talhões a cada', 'km'],
  ['alerta_mm24', 'Alerta: chuva prevista em 24 h', 'mm'],
  ['alerta_prob6', 'Alerta: chance nas próximas 6 h', '%'],
];

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function Ajustes() {
  const [f, setF] = useState<Limites>(limites.value);
  const [safra, setSafra] = useState(f.safra_inicio);
  const [msg, setMsg] = useState<string | null>(null);
  const kml = useRef<HTMLInputElement>(null);
  const bk = useRef<HTMLInputElement>(null);

  const salvar = async () => {
    try {
      const r = await enviar<Limites>(`/api/limites?fazenda=${FAZENDA}`, 'PUT', { ...f, safra_inicio: safra });
      limites.value = r;
      setMsg('Limites salvos.');
      carregar(true);
    } catch (e) {
      setMsg(`Não salvou: ${(e as Error).message}`);
    }
  };

  const importarKml = async (file: File) => {
    if (!confirm(`Importar "${file.name}"? Talhões com o mesmo nome serão atualizados.`)) return;
    try {
      const r = await enviar<any>('/api/importar', 'POST', { nome: 'Fazenda Lagoa Formosa', fuso: 'America/Sao_Paulo', kml: await file.text() });
      setMsg(`${r.importados} talhões importados (${r.ha_total} ha). ${(r.avisos || []).join(' ')}`);
      carregar(true);
    } catch (e) {
      setMsg(`Importação falhou: ${(e as Error).message}`);
    }
  };

  const restaurar = async (file: File) => {
    try {
      const j = JSON.parse(await file.text());
      const lista = Array.isArray(j) ? j : j.medidas;
      if (!Array.isArray(lista)) throw new Error('arquivo sem lista de medidas');
      const nomes = new Map(talhoes.value.map((t) => [t.nome.toLowerCase(), t.id]));
      const itens = lista
        .map((m: any) => ({
          fazenda_id: FAZENDA,
          talhao_id: m.talhao_id || (m.talhao ? nomes.get(String(m.talhao).toLowerCase()) : null) || null,
          data: String(m.data || m.date).slice(0, 10),
          mm: Number(m.mm),
          obs: m.obs || null,
          origem: 'backup',
        }))
        .filter((m: any) => /^\d{4}-\d{2}-\d{2}$/.test(m.data) && isFinite(m.mm) && m.mm >= 0);
      if (!itens.length) throw new Error('nenhum registro válido');
      if (!confirm(`Restaurar ${itens.length} lançamentos? (podem duplicar o que já existe)`)) return;
      await enviar('/api/medidas', 'POST', itens);
      setMsg(`${itens.length} lançamentos restaurados.`);
      carregar(true);
    } catch (e) {
      setMsg(`Restauração falhou: ${(e as Error).message}`);
    }
  };

  const ativarPush = async () => {
    try {
      const chave = import.meta.env.VITE_VAPID_PUBLIC as string | undefined;
      if (!chave) throw new Error('chave VAPID não configurada neste deploy');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('este navegador não suporta notificações push');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('permissão negada');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) });
      await enviar('/api/push', 'POST', { fazenda_id: FAZENDA, sub: sub.toJSON() });
      setMsg('Notificações ativadas neste aparelho.');
    } catch (e) {
      setMsg(`Notificações: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div class="card">
        <h2>Fazenda</h2>
        <b>Lagoa Formosa (MG)</b>
        <div class="muted">
          Fuso America/Sao_Paulo · {talhoes.value.length} talhões
        </div>
        <input ref={kml} type="file" accept=".kml,application/vnd.google-earth.kml+xml,text/xml" hidden onChange={(e) => { const x = (e.target as HTMLInputElement).files?.[0]; if (x) importarKml(x); }} />
        <button class="btn sec full" style="margin-top:12px" onClick={() => kml.current?.click()}>
          Importar KML dos talhões
        </button>
      </div>

      <div class="card">
        <h2>Limites dos semáforos e alertas</h2>
        {CAMPOS.map(([k, nome, un]) => (
          <div key={k}>
            <label for={k}>
              {nome} ({un})
            </label>
            <input id={k} inputMode="decimal" value={String(f[k]).replace('.', ',')} onInput={(e) => setF({ ...f, [k]: Number((e.target as HTMLInputElement).value.replace(',', '.')) || 0 })} />
          </div>
        ))}
        <label for="sf">Início da safra (mês-dia)</label>
        <input id="sf" value={safra} pattern="\d{2}-\d{2}" onInput={(e) => setSafra((e.target as HTMLInputElement).value)} />
        <div class="row" style="margin-top:12px">
          <button class="btn" onClick={salvar}>
            Salvar limites
          </button>
          <button class="btn sec" onClick={() => setF(LIMITES_PADRAO)}>
            Padrão
          </button>
        </div>
        <div class="aviso">Confirme sempre pela bula e pelo receituário. Estes limites são apoio à decisão, não recomendação técnica.</div>
      </div>

      <div class="card">
        <h2>Notificações</h2>
        <div class="muted">Alerta com o app fechado: ≥ {f.alerta_mm24} mm em 24 h ou ≥ {f.alerta_prob6}% de chance nas próximas 6 h (1 vez por dia por tipo).</div>
        <button class="btn full" style="margin-top:12px" onClick={ativarPush}>
          <IcSino /> Ativar neste aparelho
        </button>
      </div>

      <div class="card">
        <h2>Backup das medições</h2>
        <div class="row">
          <button class="btn sec" onClick={() => baixar(`backup-chuva-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ versao: 1, medidas: medidas.value }, null, 1), 'application/json')}>
            <IcBaixar /> Baixar backup
          </button>
          <input ref={bk} type="file" accept="application/json" hidden onChange={(e) => { const x = (e.target as HTMLInputElement).files?.[0]; if (x) restaurar(x); }} />
          <button class="btn sec" onClick={() => bk.current?.click()}>
            Restaurar
          </button>
        </div>
      </div>
      {msg && (
        <div class="toast" role="status" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}
    </>
  );
}
