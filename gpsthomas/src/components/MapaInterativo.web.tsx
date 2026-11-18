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

/** Marcador de vértice: círculo visível pequeno dentro de uma área de toque de 44 px. */
function pino(primeiro: boolean, selecionado: boolean): L.DivIcon {
  const caixa = document.createElement('div');
  caixa.style.cssText = 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  const d = selecionado ? 26 : primeiro ? 24 : 18;
  const c = document.createElement('div');
  c.style.cssText = `width:${d}px;height:${d}px;border-radius:50%;background:${selecionado ? AMBAR : '#fff'};border:2.5px solid ${selecionado ? '#fff' : VERDE};box-shadow:0 1px 6px rgba(0,0,0,.45)${selecionado ? ',0 0 0 7px rgba(242,183,61,.35)' : ''};box-sizing:border-box;`;
  caixa.appendChild(c);
  return L.divIcon({ html: caixa, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
}

/** Alça de arraste (setas nos quatro sentidos), colocada ao lado do ponto. */
function iconeAlca(): L.DivIcon {
  const caixa = document.createElement('div');
  caixa.className = 'gt-alca';
  caixa.style.cssText = 'width:64px;height:64px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent;';
  const c = document.createElement('div');
  c.style.cssText = `width:50px;height:50px;border-radius:50%;background:${AMBAR};border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;`;
  c.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#2B1D00" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';
  caixa.appendChild(c);
  return L.divIcon({ html: caixa, className: '', iconSize: [64, 64], iconAnchor: [32, 32] });
}

function centro(pts: Coord[]): Coord {
  const n = pts.length || 1;
  return [pts.reduce((s, c) => s + c[0], 0) / n, pts.reduce((s, c) => s + c[1], 0) / n];
}

const CSS = '.gt-alca:active{cursor:grabbing}.gt-veic{transition:transform .9s linear!important}.gt-veic-giro{transition:transform .6s ease-out}.leaflet-bottom.leaflet-right{margin-bottom:86px}.leaflet-control-attribution{font:500 9.5px Inter,system-ui,sans-serif!important;background:rgba(0,0,0,.5)!important;color:#fff!important;border-radius:8px 0 0 8px;padding:2px 8px!important}.leaflet-container{font-family:Inter,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}';

export function MapaInterativo(props: PropsMapa) {
  const el = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const mapa = useRef<L.Map | null>(null);
  const grupos = useRef<{ base: L.LayerGroup; talhoes: L.LayerGroup; campo: L.LayerGroup; rotas: L.LayerGroup; rascunho: L.LayerGroup; fantasma: L.LayerGroup; pos: L.LayerGroup } | null>(null);
  const primeiraVez = useRef(true);
  const veic = useRef<{ mk: L.Marker; giro: HTMLDivElement; tipo: Veiculo } | null>(null);
  const ultimaSel = useRef<number | null>(null);

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
      fantasma: L.layerGroup().addTo(m),
      pos: L.layerGroup().addTo(m),
    };
    m.on('click', (e: L.LeafletMouseEvent) => P.current.onAdicionar(deLL(e.latlng)));
    let quadro = 0;
    const avisarCentro = () => { if (P.current.mira) P.current.onCentro?.(deLL(m.getCenter())); };
    m.on('move', () => { if (!P.current.mira || quadro) return; quadro = requestAnimationFrame(() => { quadro = 0; avisarCentro(); }); });
    m.on('moveend', avisarCentro);
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
      L.polygon(t.contorno.map(paraLL), { color: AMBAR, weight: 2, fillColor: AMBAR, fillOpacity: 0.16, interactive: false }).addTo(g.talhoes);
      const rot = document.createElement('div');
      rot.style.cssText = 'background:rgba(10,17,13,.82);color:#fff;border-radius:12px;padding:5px 10px;font:500 12px Inter,system-ui,sans-serif;white-space:nowrap;width:max-content;box-shadow:0 2px 8px rgba(0,0,0,.4);text-align:center;cursor:pointer;transform:translate(-50%,-50%);';
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
    const m = mapa.current;
    if (!g || !m) return;
    g.rascunho.clearLayers();
    const pts = props.rascunho;
    if (pts.length === 0) return;
    const sel = props.selecionado != null && props.selecionado < pts.length ? props.selecionado : null;
    if (sel == null) ultimaSel.current = null;
    let forma: L.Path & { setLatLngs: (l: L.LatLngExpression[]) => unknown };
    const ll = pts.map(paraLL);
    if (props.poligono && pts.length >= 3) forma = L.polygon(ll, { color: VERDE, weight: 2.5, fillColor: VERDE, fillOpacity: 0.22, interactive: false });
    else forma = L.polyline(ll, { color: VERDE, weight: 3, interactive: false });
    forma.addTo(g.rascunho);
    let marcadorSel: L.Marker | null = null;
    pts.forEach((c, i) => {
      const ehSel = i === sel;
      // o ponto selecionado só se move pela alça (evita arrastar sem querer com o dedo em cima)
      const mk = L.marker(paraLL(c), { icon: pino(i === 0, ehSel), draggable: !ehSel, autoPan: true, keyboard: false, zIndexOffset: ehSel ? 500 : 0 }).addTo(g.rascunho);
      if (ehSel) marcadorSel = mk;
      mk.on('drag', () => {
        const nl = ll.slice();
        nl[i] = [mk.getLatLng().lat, mk.getLatLng().lng];
        forma.setLatLngs(nl);
      });
      mk.on('dragend', () => P.current.onMover(i, deLL(mk.getLatLng())));
      mk.on('click', (e) => { L.DomEvent.stopPropagation(e); P.current.onSelecionar?.(ehSel ? null : i); });
    });

    // alça ao lado do ponto selecionado: o dedo fica na alça e o ponto aparece livre
    if (sel != null && marcadorSel) {
      const selMk = marcadorSel as L.Marker;
      const tam = m.getSize();
      const topo = P.current.margemTopo ?? 190;
      const base = P.current.margemBase ?? 340;
      // ao selecionar, leva o ponto para a área livre (fora dos painéis) antes de desenhar a alça
      if (ultimaSel.current !== sel) {
        const q = m.latLngToContainerPoint(ll[sel]);
        const fora = q.y < topo + 40 || q.y > tam.y - base - 40 || q.x < 50 || q.x > tam.x - 110;
        if (fora) {
          const alvoY = Math.round((topo + (tam.y - base)) / 2);
          const alvoX = Math.min(Math.max(q.x, 70), tam.x - 120);
          m.panBy([q.x - alvoX, q.y - alvoY], { animate: false });
        }
      }
      ultimaSel.current = sel;
      const ponto = m.latLngToContainerPoint(ll[sel]);
      const dx = ponto.x > tam.x - 130 ? -78 : 78;
      const dy = ponto.y + 78 > tam.y - base - 16 ? -78 : 78;
      const posAlca = m.containerPointToLatLng([ponto.x + dx, ponto.y + dy]);
      const ligacao = L.polyline([ll[sel], posAlca], { color: '#fff', weight: 1.75, dashArray: '2 6', opacity: 0.95, interactive: false }).addTo(g.rascunho);
      const alca = L.marker(posAlca, { icon: iconeAlca(), draggable: true, autoPan: false, keyboard: false, zIndexOffset: 1000 }).addTo(g.rascunho);
      let alcaIni = L.point(0, 0);
      let pontoIni = L.point(0, 0);
      alca.on('dragstart', () => {
        alcaIni = m.latLngToLayerPoint(alca.getLatLng());
        pontoIni = m.latLngToLayerPoint(ll[sel]);
      });
      alca.on('drag', () => {
        const f = P.current.fatorAlca ?? 1;
        const a = m.latLngToLayerPoint(alca.getLatLng());
        const novo = m.layerPointToLatLng(L.point(pontoIni.x + (a.x - alcaIni.x) * f, pontoIni.y + (a.y - alcaIni.y) * f));
        selMk.setLatLng(novo);
        const nl = ll.slice();
        nl[sel] = [novo.lat, novo.lng];
        forma.setLatLngs(nl);
        ligacao.setLatLngs([novo, alca.getLatLng()]);
      });
      alca.on('dragend', () => P.current.onMover(sel, deLL(selMk.getLatLng())));
    }
  }, [props.rascunho, props.poligono, props.selecionado]);

  // ponto provisório da mira (tracejado)
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.fantasma.clearLayers();
    const f = props.fantasma;
    const pts = props.rascunho;
    if (!f || pts.length === 0) return;
    const opc = { color: '#fff', weight: 2, dashArray: '4 7', opacity: 0.95, interactive: false } as L.PolylineOptions;
    L.polyline([paraLL(pts[pts.length - 1]), paraLL(f)], opc).addTo(g.fantasma);
    if (props.poligono && pts.length >= 2) L.polyline([paraLL(f), paraLL(pts[0])], { ...opc, opacity: 0.55 }).addTo(g.fantasma);
  }, [props.fantasma, props.rascunho, props.poligono]);

  // ao ligar a mira, avisa o centro atual
  useEffect(() => {
    if (props.mira && mapa.current) props.onCentro?.(deLL(mapa.current.getCenter()));
  }, [props.mira]);

  // posição do GPS
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.pos.clearLayers();
    const p = props.posicao;
    if (!p || props.veiculo) return;
    if (p.precisaoM) L.circle(paraLL(p.coord), { radius: p.precisaoM, color: '#3B82F6', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(g.pos);
    L.circleMarker(paraLL(p.coord), { radius: 7, color: '#fff', weight: 2.5, fillColor: '#3B82F6', fillOpacity: 1, interactive: false }).addTo(g.pos);
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
        L.polygon(anel.map(paraLL), { color: pc.cor, weight: 1.75, fillColor: pc.cor, fillOpacity: props.linhaGuia ? 0.2 : 0.38, interactive: false }).addTo(g.campo);
      }
      const todos = pc.pedacos.flat();
      if (todos.length) {
        const rot = document.createElement('div');
        rot.style.cssText = 'background:rgba(10,17,13,.85);color:#fff;border-radius:10px;padding:4px 9px;font:500 11.5px Inter,system-ui,sans-serif;white-space:nowrap;width:max-content;text-align:center;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;';
        const a = document.createElement('div'); a.textContent = pc.rotulo;
        rot.appendChild(a);
        if (pc.sub) { const b = document.createElement('div'); b.textContent = pc.sub; b.style.cssText = 'font-weight:500;opacity:.8;font-size:10.5px;'; rot.appendChild(b); }
        L.marker(paraLL(centro(todos)), { icon: L.divIcon({ html: rot, className: '', iconSize: [0, 0] }), interactive: false }).addTo(g.campo);
      }
    }
    if (props.linhaGuia) L.polyline(props.linhaGuia.map(paraLL), { color: '#F2B73D', weight: 3, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(g.campo);
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
      L.polyline(ll, { color: '#fff', weight: ativa ? 9 : 7.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g.rotas);
      const linha = L.polyline(ll, { color: ativa ? '#2F7DF6' : '#8A97A6', weight: ativa ? 5 : 4.5, lineCap: 'round', lineJoin: 'round', interactive: !ativa }).addTo(g.rotas);
      if (ativa && props.progressoIdx && props.progressoIdx > 0) {
        L.polyline(rotas[i].slice(0, props.progressoIdx + 1).map(paraLL), { color: '#8A97A6', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g.rotas);
      }
      if (!ativa) linha.on('click', (e) => { L.DomEvent.stopPropagation(e); P.current.onRota?.(i); });
    }
    if (props.destino) {
      const el2 = document.createElement('div');
      el2.style.cssText = 'width:30px;height:30px;border-radius:50% 50% 50% 0;background:#E5484D;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.5);box-sizing:border-box;';
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
