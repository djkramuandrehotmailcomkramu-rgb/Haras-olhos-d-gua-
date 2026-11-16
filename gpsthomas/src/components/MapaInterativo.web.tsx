import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coord } from '../geo/medidas';
import type { PropsMapa } from './MapaInterativo.types';

const paraLL = (c: Coord): L.LatLngTuple => [c[1], c[0]];
const deLL = (p: L.LatLng): Coord => [p.lng, p.lat];

const CAMADAS = {
  satelite: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    rotulos: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagens © Esri, Maxar, Earthstar Geographics',
  },
  mapa: { base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', rotulos: null, attr: '© OpenStreetMap' },
} as const;

const VERDE = '#3FB063';
const AMBAR = '#F2B73D';

function pino(grande: boolean): L.DivIcon {
  const d = grande ? 24 : 18;
  const el = document.createElement('div');
  el.style.cssText = `width:${d}px;height:${d}px;border-radius:50%;background:#fff;border:4px solid ${VERDE};box-shadow:0 2px 8px rgba(0,0,0,.45);box-sizing:border-box;`;
  return L.divIcon({ html: el, className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
}

function centro(pts: Coord[]): Coord {
  const n = pts.length || 1;
  return [pts.reduce((s, c) => s + c[0], 0) / n, pts.reduce((s, c) => s + c[1], 0) / n];
}

const CSS = '.leaflet-bottom.leaflet-right{margin-bottom:86px}.leaflet-control-attribution{font:500 9.5px Inter,system-ui,sans-serif!important;background:rgba(0,0,0,.5)!important;color:#fff!important;border-radius:8px 0 0 8px;padding:2px 8px!important}.leaflet-container{font-family:Inter,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}';

export function MapaInterativo(props: PropsMapa) {
  const el = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const mapa = useRef<L.Map | null>(null);
  const grupos = useRef<{ base: L.LayerGroup; talhoes: L.LayerGroup; rascunho: L.LayerGroup; pos: L.LayerGroup } | null>(null);
  const primeiraVez = useRef(true);

  useEffect(() => {
    if (!el.current) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, maxZoom: 20, tap: true } as L.MapOptions).setView([-15.78, -47.93], 4);
    m.attributionControl.setPrefix(false);
    grupos.current = {
      base: L.layerGroup().addTo(m),
      talhoes: L.layerGroup().addTo(m),
      rascunho: L.layerGroup().addTo(m),
      pos: L.layerGroup().addTo(m),
    };
    m.on('click', (e: L.LeafletMouseEvent) => P.current.onAdicionar(deLL(e.latlng)));
    mapa.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      st.remove();
      m.remove();
      mapa.current = null;
    };
  }, []);

  // camada de fundo
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.base.clearLayers();
    const c = CAMADAS[props.camada];
    L.tileLayer(c.base, { maxZoom: 20, maxNativeZoom: 19, attribution: c.attr, crossOrigin: true }).addTo(g.base);
    if (c.rotulos) L.tileLayer(c.rotulos, { maxZoom: 20, maxNativeZoom: 19, opacity: 0.9, crossOrigin: true }).addTo(g.base);
  }, [props.camada]);

  // talhões salvos
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.talhoes.clearLayers();
    for (const t of props.talhoes) {
      if (t.contorno.length < 3) continue;
      L.polygon(t.contorno.map(paraLL), { color: AMBAR, weight: 3, fillColor: AMBAR, fillOpacity: 0.18, interactive: false }).addTo(g.talhoes);
      const rot = document.createElement('div');
      rot.style.cssText = 'background:rgba(10,17,13,.82);color:#fff;border-radius:12px;padding:5px 10px;font:600 12px Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.4);text-align:center;cursor:pointer;transform:translate(-50%,-50%);';
      const n = document.createElement('div');
      n.textContent = t.nome;
      const r = document.createElement('div');
      r.textContent = t.rotulo;
      r.style.cssText = 'font-weight:500;opacity:.8;font-size:11px;';
      rot.append(n, r);
      const mk = L.marker(paraLL(centro(t.contorno)), { icon: L.divIcon({ html: rot, className: '', iconSize: [0, 0] }) }).addTo(g.talhoes);
      mk.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        P.current.onTalhao(t.id);
      });
    }
    if (primeiraVez.current && props.talhoes.length) {
      primeiraVez.current = false;
      const todos = props.talhoes.flatMap((t) => t.contorno);
      mapa.current?.fitBounds(L.latLngBounds(todos.map(paraLL)), { padding: [70, 70], maxZoom: 17 });
    }
  }, [props.talhoes]);

  // rascunho (medição em andamento)
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.rascunho.clearLayers();
    const pts = props.rascunho;
    if (pts.length === 0) return;
    let forma: L.Path & { setLatLngs: (l: L.LatLngExpression[]) => unknown };
    const ll = pts.map(paraLL);
    if (props.poligono && pts.length >= 3) forma = L.polygon(ll, { color: VERDE, weight: 4, fillColor: VERDE, fillOpacity: 0.25, interactive: false });
    else forma = L.polyline(ll, { color: VERDE, weight: 4, interactive: false });
    forma.addTo(g.rascunho);
    pts.forEach((c, i) => {
      const mk = L.marker(paraLL(c), { icon: pino(i === 0), draggable: true, autoPan: true }).addTo(g.rascunho);
      mk.on('drag', () => {
        const nl = ll.slice();
        nl[i] = [mk.getLatLng().lat, mk.getLatLng().lng];
        forma.setLatLngs(nl);
      });
      mk.on('dragend', () => P.current.onMover(i, deLL(mk.getLatLng())));
      mk.on('click', (e) => L.DomEvent.stopPropagation(e));
    });
  }, [props.rascunho, props.poligono]);

  // posição do GPS
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.pos.clearLayers();
    const p = props.posicao;
    if (!p) return;
    if (p.precisaoM) L.circle(paraLL(p.coord), { radius: p.precisaoM, color: '#3B82F6', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(g.pos);
    L.circleMarker(paraLL(p.coord), { radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1, interactive: false }).addTo(g.pos);
  }, [props.posicao]);

  // comandos (voar para, ajustar)
  useEffect(() => {
    const c = props.comando;
    const m = mapa.current;
    if (!c || !m) return;
    if (c.tipo === 'voar') m.flyTo(paraLL(c.coord), c.zoom ?? 18, { duration: 0.8 });
    else if (c.pontos.length) m.fitBounds(L.latLngBounds(c.pontos.map(paraLL)), { padding: [70, 70], maxZoom: 18 });
  }, [props.comando]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      <div ref={el} style={{ width: '100%', height: '100%', background: '#1b2a21' }} />
    </View>
  );
}
