import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coord } from '../geo/medidas';
import type { PropsMapa } from './MapaInterativo.types';
import { svgVeiculo, type Veiculo } from './veiculos';

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

const CSS = '.gt-veic{transition:transform .9s linear!important}.gt-veic-giro{transition:transform .6s ease-out}.leaflet-bottom.leaflet-right{margin-bottom:86px}.leaflet-control-attribution{font:500 9.5px Inter,system-ui,sans-serif!important;background:rgba(0,0,0,.5)!important;color:#fff!important;border-radius:8px 0 0 8px;padding:2px 8px!important}.leaflet-container{font-family:Inter,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}';

export function MapaInterativo(props: PropsMapa) {
  const el = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const mapa = useRef<L.Map | null>(null);
  const grupos = useRef<{ base: L.LayerGroup; talhoes: L.LayerGroup; campo: L.LayerGroup; rotas: L.LayerGroup; rascunho: L.LayerGroup; pos: L.LayerGroup } | null>(null);
  const primeiraVez = useRef(true);
  const veic = useRef<{ mk: L.Marker; giro: HTMLDivElement; tipo: Veiculo } | null>(null);

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
      campo: L.layerGroup().addTo(m),
      rotas: L.layerGroup().addTo(m),
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
      rot.style.cssText = 'background:rgba(10,17,13,.82);color:#fff;border-radius:12px;padding:5px 10px;font:600 12px Inter,system-ui,sans-serif;white-space:nowrap;width:max-content;box-shadow:0 2px 8px rgba(0,0,0,.4);text-align:center;cursor:pointer;transform:translate(-50%,-50%);';
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
    if (!p || props.veiculo) return;
    if (p.precisaoM) L.circle(paraLL(p.coord), { radius: p.precisaoM, color: '#3B82F6', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(g.pos);
    L.circleMarker(paraLL(p.coord), { radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1, interactive: false }).addTo(g.pos);
  }, [props.posicao, !!props.veiculo]);

  // veículo (ícone que gira com o rumo)
  useEffect(() => {
    const g = grupos.current;
    const v = props.veiculo;
    if (!g || !mapa.current) return;
    if (!v) {
      veic.current?.mk.remove();
      veic.current = null;
      return;
    }
    if (!veic.current || veic.current.tipo !== v.tipo) {
      veic.current?.mk.remove();
      const caixa = document.createElement('div');
      caixa.style.cssText = 'width:64px;height:64px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));';
      const giro = document.createElement('div');
      giro.className = 'gt-veic-giro';
      giro.style.cssText = 'width:64px;height:64px;';
      giro.innerHTML = svgVeiculo(v.tipo, '#1F7A3E', 64);
      caixa.appendChild(giro);
      const mk = L.marker(paraLL(v.coord), { icon: L.divIcon({ html: caixa, className: 'gt-veic', iconSize: [64, 64], iconAnchor: [32, 32] }), interactive: false, zIndexOffset: 1000 }).addTo(mapa.current!);
      veic.current = { mk, giro, tipo: v.tipo };
    }
    veic.current.mk.setLatLng(paraLL(v.coord));
    veic.current.giro.style.transform = `rotate(${v.rumo}deg)`;
  }, [props.veiculo?.coord, props.veiculo?.rumo, props.veiculo?.tipo]);

  // parcelas, bandeiras e linha-guia do campo de sementes
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.campo.clearLayers();
    for (const pc of props.parcelas ?? []) {
      for (const anel of pc.pedacos) {
        if (anel.length < 3) continue;
        L.polygon(anel.map(paraLL), { color: pc.cor, weight: 2.5, fillColor: pc.cor, fillOpacity: props.linhaGuia ? 0.2 : 0.38, interactive: false }).addTo(g.campo);
      }
      const todos = pc.pedacos.flat();
      if (todos.length) {
        const rot = document.createElement('div');
        rot.style.cssText = 'background:rgba(10,17,13,.85);color:#fff;border-radius:10px;padding:4px 9px;font:600 11.5px Inter,system-ui,sans-serif;white-space:nowrap;width:max-content;text-align:center;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;';
        const a = document.createElement('div'); a.textContent = pc.rotulo;
        rot.appendChild(a);
        if (pc.sub) { const b = document.createElement('div'); b.textContent = pc.sub; b.style.cssText = 'font-weight:500;opacity:.8;font-size:10.5px;'; rot.appendChild(b); }
        L.marker(paraLL(centro(todos)), { icon: L.divIcon({ html: rot, className: '', iconSize: [0, 0] }), interactive: false }).addTo(g.campo);
      }
    }
    if (props.linhaGuia) L.polyline(props.linhaGuia.map(paraLL), { color: '#F2B73D', weight: 4, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(g.campo);
    for (const b of props.bandeiras ?? []) {
      const cor = b.estado === 'ok' ? '#3FB063' : b.estado === 'atual' ? '#F2B73D' : '#9AA7A0';
      const grande = b.estado === 'atual';
      const tam = grande ? 32 : 24;
      const caixa = document.createElement('div');
      caixa.style.cssText = 'width:48px;height:48px;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;';
      const bandeira = document.createElement('div');
      bandeira.style.cssText = `position:absolute;left:4px;bottom:6px;width:${tam}px;height:${tam}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));transition:transform .15s;`;
      bandeira.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 2 V22" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3 H19 L15.5 7.5 L19 12 H6 Z" fill="${cor}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
      caixa.appendChild(bandeira);
      const mkb = L.marker(paraLL(b.coord), { icon: L.divIcon({ html: caixa, className: '', iconSize: [48, 48], iconAnchor: [4 + tam * (5 / 24), 48 - 6] }), interactive: true, zIndexOffset: grande ? 900 : 0, keyboard: false }).addTo(g.campo);
      mkb.on('click', (e) => { L.DomEvent.stopPropagation(e); P.current.onBandeira?.(b.id); });
    }
  }, [props.parcelas, props.bandeiras, props.linhaGuia]);

  // rotas e destino
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.rotas.clearLayers();
    const rotas = props.rotas ?? [];
    const ordem = rotas.map((_, i) => i).sort((a, b) => (a === props.rotaAtiva ? 1 : 0) - (b === props.rotaAtiva ? 1 : 0));
    for (const i of ordem) {
      const ativa = i === (props.rotaAtiva ?? 0);
      const ll = rotas[i].map(paraLL);
      L.polyline(ll, { color: '#fff', weight: ativa ? 11 : 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g.rotas);
      const linha = L.polyline(ll, { color: ativa ? '#2F7DF6' : '#8A97A6', weight: ativa ? 7 : 6, lineCap: 'round', lineJoin: 'round', interactive: !ativa }).addTo(g.rotas);
      if (ativa && props.progressoIdx && props.progressoIdx > 0) {
        L.polyline(rotas[i].slice(0, props.progressoIdx + 1).map(paraLL), { color: '#8A97A6', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g.rotas);
      }
      if (!ativa) linha.on('click', (e) => { L.DomEvent.stopPropagation(e); P.current.onRota?.(i); });
    }
    if (props.destino) {
      const el2 = document.createElement('div');
      el2.style.cssText = 'width:30px;height:30px;border-radius:50% 50% 50% 0;background:#E5484D;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.5);box-sizing:border-box;';
      L.marker(paraLL(props.destino), { icon: L.divIcon({ html: el2, className: '', iconSize: [30, 30], iconAnchor: [15, 30] }), interactive: false }).addTo(g.rotas);
    }
  }, [props.rotas, props.rotaAtiva, props.destino, props.progressoIdx]);

  // câmera acompanha a posição
  useEffect(() => {
    const m = mapa.current;
    if (!m || !props.seguir) return;
    m.setView(paraLL(props.seguir), Math.max(m.getZoom(), 17), { animate: true, duration: 0.6 } as L.ZoomPanOptions);
  }, [props.seguir]);

  // comandos (voar para, ajustar)
  useEffect(() => {
    const c = props.comando;
    const m = mapa.current;
    if (!c || !m) return;
    if (c.tipo === 'voar') m.flyTo(paraLL(c.coord), c.zoom ?? 18, { duration: 0.8 });
    else if (c.pontos.length) m.fitBounds(L.latLngBounds(c.pontos.map(paraLL)), { paddingTopLeft: [50, 150], paddingBottomRight: [50, 330], maxZoom: 18 });
  }, [props.comando]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      <div ref={el} style={{ width: '100%', height: '100%', background: '#1b2a21' }} />
    </View>
  );
}
