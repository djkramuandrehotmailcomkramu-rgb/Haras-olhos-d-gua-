import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lugar } from '../../shared/tipos';
import { abrirLugar, buscaAberta, lerRecentes, lugar } from '../state';
import { getJson } from '../net';
import { IcPino } from '../icons';

const COORD = /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[;, ]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/;

export function Buscar() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Lugar[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (buscaAberta.value = false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  useEffect(() => {
    const m = COORD.exec(q);
    if (m) {
      const lat = Number(m[1].replace(',', '.'));
      const lon = Number(m[2].replace(',', '.'));
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        setRes([{ nome: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, detalhe: 'Coordenadas', lat, lon, tipo: 'Ponto' }]);
        setMsg(null);
        return;
      }
    }
    if (q.trim().length < 2) {
      setRes([]);
      setMsg(null);
      return;
    }
    const id = ++seq.current;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await getJson<Lugar[]>(`/api/buscar?q=${encodeURIComponent(q.trim())}`);
        if (id !== seq.current) return;
        setRes(r.data);
        setMsg(r.data.length ? null : 'Nada encontrado. Tente o nome da cidade ou "lat, lon".');
      } catch (e) {
        if (id === seq.current) setMsg(`Busca indisponível: ${(e as Error).message}`);
      } finally {
        if (id === seq.current) setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const gps = () => {
    if (!navigator.geolocation) return setMsg('GPS indisponível neste aparelho.');
    setMsg('Procurando sua posição…');
    navigator.geolocation.getCurrentPosition(
      (p) => abrirLugar({ nome: 'Minha localização', detalhe: 'GPS', lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, tipo: 'Ponto' }),
      (e) => setMsg(`Não consegui o GPS: ${e.message}`),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const recentes = lerRecentes();
  const lista = q.trim().length >= 2 ? res : recentes;
  return (
    <div class="busca" role="dialog" aria-modal="true" aria-label="Pesquisar local">
      <div class="busca-top">
        <input ref={ref} type="search" inputMode="search" placeholder="Cidade, estado ou lat, lon" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Pesquisar cidade, estado ou coordenadas" />
        <button class="btn sec" onClick={() => (buscaAberta.value = false)}>
          Fechar
        </button>
      </div>
      <button class="op" style="width:100%;margin-bottom:10px" onClick={gps}>
        <IcPino size={20} /> Usar minha localização
      </button>
      {lugar.value && (
        <button class="op" style="width:100%;margin-bottom:10px" onClick={() => (abrirLugar(null), (buscaAberta.value = false))}>
          Voltar para a Fazenda Lagoa Formosa
        </button>
      )}
      <div class="muted" style="margin:4px 2px 6px">
        {q.trim().length >= 2 ? (buscando ? 'Buscando…' : 'Resultados') : recentes.length ? 'Pesquisados recentemente' : 'Digite o nome de uma cidade ou estado'}
      </div>
      {msg && <div class="aviso" role="status">{msg}</div>}
      <div class="card" style={lista.length ? '' : 'display:none'}>
        {lista.map((l) => (
          <div class="tal" key={`${l.lat},${l.lon},${l.nome}`} role="button" tabIndex={0} onClick={() => abrirLugar(l)} onKeyDown={(e) => e.key === 'Enter' && abrirLugar(l)}>
            <div class="n">
              <b>{l.nome}</b>
              <small>{l.detalhe || `${l.lat}, ${l.lon}`}</small>
            </div>
            <span class="badge">{l.tipo || 'Local'}</span>
          </div>
        ))}
      </div>
      <div class="aviso">A previsão de outro local usa os mesmos modelos e o ensemble, com pesos calculados no histórico de 90 dias daquele ponto. Estado = ponto central (não representa o estado todo). Sem seu pluviômetro, não há correção de viés.</div>
    </div>
  );
}
