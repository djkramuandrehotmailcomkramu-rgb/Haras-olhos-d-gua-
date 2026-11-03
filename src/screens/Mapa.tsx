import { useEffect, useRef, useState } from 'preact/hooks';
import L from 'leaflet';
import { payload, talhoes } from '../state';
import { LEGENDA_FAIXAS, faixaMm, fmtMm } from '../../shared/calc';
import { CORES_FAIXA, useLinhas } from './Talhoes';
import { dentro } from '../derive';
import { IcPausa, IcPino, IcPlay, IcRadar } from '../icons';

type Per = 'hoje' | '3d' | '7d' | '15d' | 'safra';
const PERS: [Per, string][] = [['hoje', 'Hoje'], ['3d', '3 dias'], ['7d', '7 dias'], ['15d', '15 dias'], ['safra', 'Safra']];

interface Frame {
  time: number;
  path: string;
}

export function Mapa() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const poligonos = useRef<L.LayerGroup | null>(null);
  const radar = useRef<L.TileLayer | null>(null);
  const [per, setPer] = useState<Per>('hoje');
  const linhas = useLinhas(per);
  const [verRadar, setVerRadar] = useState(false);
  const [frames, setFrames] = useState<{ host: string; list: Frame[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState(false);
  const [gps, setGps] = useState<string | null>(null);
  const [radarErro, setRadarErro] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([-16.272, -46.13], 12);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagem © Esri' });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    sat.addTo(m);
    L.control.layers({ Satélite: sat, Mapa: osm }, {}, { position: 'topright' }).addTo(m);
    poligonos.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const grp = poligonos.current;
    if (!m || !grp) return;
    grp.clearLayers();
    const bounds: L.LatLng[] = [];
    for (const { t, mm, prob, g } of linhas) {
      const pts = t.geom.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
      const cor = CORES_FAIXA[faixaMm(mm)];
      const poly = L.polygon(pts, { color: '#fff', weight: 1.5, fillColor: cor, fillOpacity: 0.62 });
      poly.bindTooltip(`${t.nome}<br><b>${fmtMm(mm)} mm</b>`, { permanent: true, direction: 'center', className: 'rot' });
      poly.bindPopup(
        `<b>${t.nome}</b><br>${t.ha ?? '—'} ha · grupo ${g?.id ?? '—'}<br>${per === 'safra' ? 'Medido na safra' : 'Previsto'}: <b>${fmtMm(mm)} mm</b>${prob != null && per !== 'safra' ? `<br>Chance: ${Math.round(prob)}%` : ''}`,
      );
      poly.addTo(grp);
      pts.forEach((p) => bounds.push(L.latLng(p)));
    }
    if (bounds.length && !(m as any)._ajustado) {
      m.fitBounds(L.latLngBounds(bounds), { padding: [16, 16] });
      (m as any)._ajustado = true;
    }
    const tmr = setTimeout(() => {
      if (map.current === m) m.invalidateSize();
    }, 50);
    return () => clearTimeout(tmr);
  }, [linhas, per]);

  // Radar RainViewer (quadros do passado). Só visual: não gera alerta.
  useEffect(() => {
    if (!verRadar || frames) return;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => r.json())
      .then((j) => {
        const list: Frame[] = j.radar?.past || [];
        if (!list.length) throw new Error('sem quadros de radar');
        setFrames({ host: j.host, list });
        setIdx(list.length - 1);
      })
      .catch((e) => setRadarErro(`Radar indisponível agora: ${e.message}`));
  }, [verRadar]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (radar.current) {
      m.removeLayer(radar.current);
      radar.current = null;
    }
    if (!verRadar || !frames) return;
    const f = frames.list[idx];
    radar.current = L.tileLayer(`${frames.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.7, maxZoom: 12, attribution: 'Radar © RainViewer' }).addTo(m);
  }, [verRadar, frames, idx]);

  useEffect(() => {
    if (!anim || !frames) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % frames.list.length), 700);
    return () => clearInterval(id);
  }, [anim, frames]);

  const onde = () => {
    if (!navigator.geolocation) return setGps('GPS indisponível neste aparelho.');
    setGps('Procurando sua posição…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const t = talhoes.value.find((x) => dentro(lat, lon, x));
        setGps(t ? `Você está no talhão ${t.nome}.` : 'Você está fora dos talhões cadastrados.');
        if (map.current) {
          map.current.setView([lat, lon], 15);
          L.circleMarker([lat, lon], { radius: 8, color: '#7BE04A', fillColor: '#7BE04A', fillOpacity: 1 }).addTo(map.current);
        }
      },
      (e) => setGps(`Não consegui o GPS: ${e.message}`),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  if (!payload.value) return <div class="sk" />;
  const hora = frames ? new Date(frames.list[idx].time * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <>
      <div class="chips" role="group" aria-label="Período">
        {PERS.map(([id, n]) => (
          <button class="chip" aria-pressed={per === id} onClick={() => setPer(id)}>
            {n}
          </button>
        ))}
      </div>
      <div id="mapa" ref={el} role="application" aria-label="Mapa dos talhões" />
      <div class="leg">
        {LEGENDA_FAIXAS.map((l, i) => (
          <span>
            <i style={`background:${CORES_FAIXA[i]}`} />
            {l} mm
          </span>
        ))}
      </div>
      <div class="row">
        <button class={`btn ${verRadar ? '' : 'sec'}`} onClick={() => setVerRadar(!verRadar)}>
          <IcRadar /> Radar
        </button>
        {verRadar && frames && (
          <button class="btn sec" onClick={() => setAnim(!anim)} aria-label={anim ? 'Pausar' : 'Animar'}>
            {anim ? <IcPausa /> : <IcPlay />} {hora}
          </button>
        )}
        <button class="btn sec" onClick={onde}>
          <IcPino /> Onde estou
        </button>
      </div>
      {radarErro && <div class="err" style="margin-top:10px">{radarErro}</div>}
      {gps && <div class="aviso" role="status">{gps}</div>}
      {verRadar && <div class="aviso">Radar RainViewer: últimas ~2 h de chuva observada. É só visual; não dispara alerta e a cobertura em MG pode ter falhas.</div>}
    </>
  );
}
