import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet-rotate';
import 'leaflet/dist/leaflet.css';
import type { Coord } from '../geo/medidas';
import type { BandeiraMapa, PropsMapa } from './MapaInterativo.types';
import { svgVeiculo, type Veiculo } from './veiculos';
import { CAMADAS, ZOOM_NATIVO_MAX } from '../mapa/camadas';
import { useUi } from '../store/dados';

const paraLL = (c: Coord): L.LatLngTuple => [c[1], c[0]];
const deLL = (p: L.LatLng): Coord => [p.lng, p.lat];

const VERDE = '#7C6BFF'; // contorno em medição: violeta, que se destaca sobre o verde/marrom da lavoura
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

type Cand = { id: string; centro: L.LatLng; limites: L.LatLngBounds; titulo: string; sub?: string; clicavel: boolean };

/** Tamanho (px) que a área ocupa no zoom atual. */
function tamanhoPx(m: L.Map, b: L.LatLngBounds) {
  const z = m.getZoom();
  const a = m.project(b.getNorthWest(), z), c = m.project(b.getSouthEast(), z);
  return { w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) };
}

function rotuloEl(titulo: string, sub: string | undefined, clicavel: boolean, compacto: boolean): HTMLElement {
  const rot = document.createElement('div');
  rot.style.cssText = `background:rgba(18,18,28,.84);color:#fff;border-radius:10px;padding:${compacto ? '3px 8px' : '4px 10px'};font:600 ${compacto ? 11 : 12}px Inter,system-ui,sans-serif;letter-spacing:-.1px;white-space:nowrap;width:max-content;text-align:center;transform:translate(-50%,-50%);box-shadow:0 1px 6px rgba(0,0,0,.35);${clicavel ? 'cursor:pointer;' : 'pointer-events:none;'}`;
  const a = document.createElement('div'); a.textContent = titulo; rot.appendChild(a);
  if (sub) { const b = document.createElement('div'); b.textContent = sub; b.style.cssText = 'font-weight:500;opacity:.75;font-size:10.5px;'; rot.appendChild(b); }
  return rot;
}

function iconeBandeira(estado: BandeiraMapa['estado'], zoom: number): L.DivIcon {
  const cor = estado === 'ok' ? '#34C759' : estado === 'aqui' ? '#00E0C6' : estado === 'atual' ? '#F2B73D' : '#9AA7A0';
  const caixa = document.createElement('div');
  caixa.style.cssText = 'width:44px;height:44px;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;';
  if (estado !== 'atual' && estado !== 'aqui' && zoom < 16) {
    // de longe: só um ponto (a bandeira inteira polui o mapa)
    const d = zoom < 14 ? 10 : 14;
    const c = document.createElement('div');
    c.style.cssText = `width:${d}px;height:${d}px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);box-sizing:border-box;`;
    caixa.appendChild(c);
    return L.divIcon({ html: caixa, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
  }
  const tam = estado === 'aqui' ? 44 : estado === 'atual' ? 34 : zoom >= 17 ? 26 : 20;
  const bandeira = document.createElement('div');
  bandeira.style.cssText = `position:absolute;left:12px;bottom:10px;width:${tam}px;height:${tam}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));`;
  bandeira.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 2 V22" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3 H19 L15.5 7.5 L19 12 H6 Z" fill="${cor}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  caixa.appendChild(bandeira);
  return L.divIcon({ html: caixa, className: '', iconSize: [44, 44], iconAnchor: [12 + tam * (5 / 24), 44 - 10] });
}

function iconeGrupo(n: number): L.DivIcon {
  const c = document.createElement('div');
  c.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#5B4FE0;color:#fff;border:2px solid #fff;font:700 13px Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:pointer;';
  c.textContent = String(n);
  return L.divIcon({ html: c, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
}

/**
 * Desenha rótulos e bandeirinhas conforme o zoom: rótulos só quando cabem e sem se sobrepor,
 * bandeirinhas perto umas das outras viram um número (toque para aproximar).
 */
function desenharLod(
  m: L.Map, g: L.LayerGroup,
  c: { talhoes: Cand[]; parcelas: Cand[]; bandeiras: BandeiraMapa[] },
  aoBandeira: (id: string) => void, aoTalhao: (id: string) => void,
) {
  g.clearLayers();
  const z = m.getZoom();
  const ocupados: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const livre = (cx: number, cy: number, w: number, h: number) => {
    const r = { x0: cx - w / 2 - 5, y0: cy - h / 2 - 4, x1: cx + w / 2 + 5, y1: cy + h / 2 + 4 };
    if (ocupados.some((o) => !(r.x1 < o.x0 || r.x0 > o.x1 || r.y1 < o.y0 || r.y0 > o.y1))) return false;
    ocupados.push(r);
    return true;
  };

  // 1) rótulos das partes do campo (têm prioridade) e depois dos talhões; os maiores primeiro
  const lista = [
    ...c.parcelas.map((x) => ({ x, tipo: 'parcela' as const })),
    ...c.talhoes.map((x) => ({ x, tipo: 'talhao' as const })),
  ].map((e) => ({ ...e, t: tamanhoPx(m, e.x.limites) })).sort((a, b) => (a.tipo === b.tipo ? b.t.w * b.t.h - a.t.w * a.t.h : a.tipo === 'parcela' ? -1 : 1));
  for (const e of lista) {
    if (e.tipo === 'talhao' && z < 12) continue;
    if (e.t.w < 52 || e.t.h < 20) continue; // não cabe dentro do desenho
    const pt = m.latLngToContainerPoint(e.x.centro);
    const duas = !!e.x.sub && z >= 15 && e.t.h >= 44;
    const w = Math.max(e.x.titulo.length * 6.6, (e.x.sub?.length ?? 0) * 6) + 20, h = duas ? 36 : 22;
    if (!livre(pt.x, pt.y, w, h)) continue;
    const mk = L.marker(e.x.centro, { icon: L.divIcon({ html: rotuloEl(e.x.titulo, duas ? e.x.sub : undefined, e.x.clicavel, !duas), className: '', iconSize: [0, 0] }), interactive: e.x.clicavel, keyboard: false }).addTo(g);
    if (e.x.clicavel) mk.on('click', (ev) => { L.DomEvent.stopPropagation(ev); aoTalhao(e.x.id); });
  }

  // 2) bandeirinhas: a próxima ("atual") sempre aparece; as demais se agrupam quando perto
  const celula = z >= 17 ? 0 : z >= 16 ? 30 : 38;
  const grupos = new Map<string, BandeiraMapa[]>();
  for (const b of c.bandeiras) {
    if (b.estado === 'atual' || b.estado === 'aqui' || celula === 0) { grupos.set(`i:${b.id}`, [b]); continue; }
    const p = m.project(L.latLng(b.coord[1], b.coord[0]), z);
    const k = `${Math.floor(p.x / celula)}:${Math.floor(p.y / celula)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), b]);
  }
  for (const membros of grupos.values()) {
    if (membros.length === 1) {
      const b = membros[0];
      const mk = L.marker(L.latLng(b.coord[1], b.coord[0]), { icon: iconeBandeira(b.estado, z), interactive: true, zIndexOffset: b.estado === 'atual' || b.estado === 'aqui' ? 900 : 0, keyboard: false }).addTo(g);
      mk.on('click', (ev) => { L.DomEvent.stopPropagation(ev); aoBandeira(b.id); });
    } else {
      const lat = membros.reduce((s, b) => s + b.coord[1], 0) / membros.length, lon = membros.reduce((s, b) => s + b.coord[0], 0) / membros.length;
      const mk = L.marker([lat, lon], { icon: iconeGrupo(membros.length), interactive: true, keyboard: false }).addTo(g);
      mk.on('click', (ev) => { L.DomEvent.stopPropagation(ev); m.fitBounds(L.latLngBounds(membros.map((b) => L.latLng(b.coord[1], b.coord[0]))), { padding: [70, 70], maxZoom: 18 }); });
    }
  }
}

const CSS = '.gt-bussola{position:absolute;z-index:1000;left:12px;top:var(--gt-topo,230px);width:44px;height:44px;border-radius:50%;border:.5px solid rgba(255,255,255,.28);background:rgba(10,17,13,.78);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .25s ease}.gt-bussola,.gt-girar{position:absolute;z-index:1000;left:12px;top:var(--gt-topo,230px);width:44px;height:44px;border-radius:50%;border:.5px solid rgba(255,255,255,.28);background:rgba(18,18,28,.78);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;transition:opacity .25s ease,background .2s ease}.gt-girar{margin-top:52px}.gt-bussola svg{transition:transform .05s linear}.gt-alca:active{cursor:grabbing}.gt-veic{transition:transform .9s linear!important}.gt-veic-giro{transition:transform .6s ease-out}.leaflet-bottom.leaflet-right{margin-bottom:86px}.leaflet-control-attribution{font:500 9.5px Inter,system-ui,sans-serif!important;background:rgba(0,0,0,.5)!important;color:#fff!important;border-radius:8px 0 0 8px;padding:2px 8px!important}.leaflet-container{font-family:Inter,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}';

export function MapaInterativo(props: PropsMapa) {
  const el = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const mapa = useRef<L.Map | null>(null);
  const grupos = useRef<{ base: L.LayerGroup; talhoes: L.LayerGroup; campo: L.LayerGroup; lod: L.LayerGroup; rotas: L.LayerGroup; rascunho: L.LayerGroup; fantasma: L.LayerGroup; pos: L.LayerGroup } | null>(null);
  // rótulos e bandeirinhas são redesenhados conforme o zoom (sem sobrepor e agrupando as que estão perto)
  const cand = useRef<{ talhoes: Cand[]; parcelas: Cand[]; bandeiras: BandeiraMapa[] }>({ talhoes: [], parcelas: [], bandeiras: [] });
  const redesenhar = useRef<() => void>(() => {});
  const primeiraVez = useRef(true);
  const veic = useRef<{ mk: L.Marker; giro: HTMLDivElement; tipo: Veiculo } | null>(null);
  const ultimaSel = useRef<number | null>(null);
  const bussola = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    // rotate/touchRotate (leaflet-rotate): gire o mapa com dois dedos (ou Ctrl + arrastar no computador).
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, maxZoom: 20, tap: true, rotate: true, touchRotate: true, bearing: 0, rotateControl: false, shiftKeyRotate: false } as L.MapOptions).setView([-15.78, -47.93], 4);
    const mr = m as L.Map & { setBearing: (g: number) => void; getBearing: () => number };
    (window as any).__gtMapa = m;
    // Bússola: aparece quando o mapa está girado; tocar volta o norte para cima.
    const bus = document.createElement('button');
    bus.type = 'button';
    bus.setAttribute('aria-label', 'Voltar o norte para cima');
    bus.className = 'gt-bussola';
    bus.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 12 H8 Z" fill="#E5484D" stroke="#E5484D" stroke-width="1"/><path d="M12 21 L8 12 H16 Z" fill="none" stroke="#fff" stroke-width="1.2"/></svg>';
    el.current.appendChild(bus);
    bussola.current = bus;
    L.DomEvent.disableClickPropagation(bus);
    bus.addEventListener('click', () => { mr.setBearing(0); });
    // Girar com dois dedos fica desligado por padrão (girava sem querer ao dar zoom); o botão liga/desliga.
    const gir = document.createElement('button');
    gir.type = 'button';
    gir.className = 'gt-girar';
    gir.setAttribute('aria-label', 'Ligar ou desligar o giro do mapa com dois dedos');
    gir.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>';
    el.current.appendChild(gir);
    L.DomEvent.disableClickPropagation(gir);
    const tr = (m as any).touchRotate;
    let girar = true;
    try { girar = localStorage.getItem('gpsthomas-girar') !== '0'; } catch {}
    const aplicarGirar = () => {
      if (tr) (girar ? tr.enable() : tr.disable());
      gir.style.opacity = '1'; gir.style.pointerEvents = 'auto';
      gir.style.background = girar ? 'rgba(91,79,224,.95)' : 'rgba(18,18,28,.78)';
      gir.setAttribute('aria-pressed', String(girar));
      if (!girar && Math.abs(mr.getBearing()) > 0.5) mr.setBearing(0);
    };
    gir.addEventListener('click', () => { girar = !girar; try { localStorage.setItem('gpsthomas-girar', girar ? '1' : '0'); } catch {} aplicarGirar(); });
    aplicarGirar();
    const girou = () => {
      const g = mr.getBearing();
      bus.style.opacity = Math.abs(g) > 0.5 && Math.abs(g - 360) > 0.5 ? '1' : '0';
      bus.style.pointerEvents = bus.style.opacity === '1' ? 'auto' : 'none';
      (bus.firstElementChild as SVGElement).style.transform = `rotate(${-g}deg)`;
    };
    m.on('rotate', girou);
    girou();
    m.attributionControl.setPrefix(false);
    grupos.current = {
      base: L.layerGroup().addTo(m),
      talhoes: L.layerGroup().addTo(m),
      campo: L.layerGroup().addTo(m),
      lod: L.layerGroup().addTo(m),
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
    const avisarVista = () => {
      const b = m.getBounds();
      const c = m.getCenter();
      const v = { oeste: b.getWest(), sul: b.getSouth(), leste: b.getEast(), norte: b.getNorth(), zoom: m.getZoom(), centro: [c.lng, c.lat] as Coord };
      useUi.getState().definirVista(v); // a tela "Mapas offline" usa a última região vista
      P.current.onVista?.(v);
    };
    m.on('moveend', avisarVista);
    m.whenReady(avisarVista);
    mapa.current = m;
    redesenhar.current = () => desenharLod(m, grupos.current!.lod, cand.current, (id) => P.current.onBandeira?.(id), (id) => P.current.onTalhao(id));
    m.on('zoomend', () => redesenhar.current());
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      bus.remove();
      gir.remove();
      st.remove();
      m.remove();
      mapa.current = null;
    };
  }, []);

  // a bússola fica logo abaixo do painel de cima
  useEffect(() => { el.current?.style.setProperty('--gt-topo', `${(props.margemTopo ?? 190) + 56}px`); }, [props.margemTopo]);

  // camada de fundo
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.base.clearLayers();
    const c = CAMADAS[props.camada];
    L.tileLayer(c.base, { maxZoom: 20, maxNativeZoom: ZOOM_NATIVO_MAX, attribution: c.attr, crossOrigin: true }).addTo(g.base);
    if (c.rotulos) L.tileLayer(c.rotulos, { maxZoom: 20, maxNativeZoom: ZOOM_NATIVO_MAX, opacity: 0.9, crossOrigin: true }).addTo(g.base);
  }, [props.camada]);

  // talhões salvos
  useEffect(() => {
    const g = grupos.current;
    if (!g) return;
    g.talhoes.clearLayers();
    cand.current.talhoes = [];
    for (const t of props.talhoes) {
      if (t.contorno.length < 3) continue;
      L.polygon(t.contorno.map(paraLL), { color: AMBAR, weight: 2, fillColor: AMBAR, fillOpacity: 0.16, interactive: false }).addTo(g.talhoes);
      cand.current.talhoes.push({ id: t.id, centro: L.latLng(paraLL(centro(t.contorno))), limites: L.latLngBounds(t.contorno.map(paraLL)), titulo: t.nome, sub: t.rotulo, clicavel: true });
    }
    redesenhar.current();
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
      giro.innerHTML = svgVeiculo(v.tipo, '#5B4FE0', 64);
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
    cand.current.parcelas = [];
    cand.current.bandeiras = props.bandeiras ?? [];
    for (const pc of props.parcelas ?? []) {
      for (const anel of pc.pedacos) {
        if (anel.length < 3) continue;
        L.polygon(anel.map(paraLL), { color: pc.cor, weight: 1.75, fillColor: pc.cor, fillOpacity: props.linhaGuia ? 0.2 : 0.38, interactive: false }).addTo(g.campo);
      }
      const todos = pc.pedacos.flat();
      if (todos.length) cand.current.parcelas.push({ id: pc.id, centro: L.latLng(paraLL(centro(todos))), limites: L.latLngBounds(todos.map(paraLL)), titulo: pc.rotulo, sub: pc.sub, clicavel: false });
    }
    if (props.rastro) {
      const { a: pa, b: pb } = props.rastro;
      const kx = Math.cos((pa[1] * Math.PI) / 180) * 111319.49, ky = 111319.49;
      const dx = (pb[0] - pa[0]) * kx, dy = (pb[1] - pa[1]) * ky, len = Math.hypot(dx, dy) || 1;
      const ponta = (c: Coord, sinal: number): Coord => [c[0] + ((dx / len) * 1200 * sinal) / kx, c[1] + ((dy / len) * 1200 * sinal) / ky];
      L.polyline([ponta(pa, -1), ponta(pb, 1)].map(paraLL), { color: '#F2B73D', weight: 1.5, dashArray: '8 8', opacity: 0.75, interactive: false }).addTo(g.campo);
      L.polyline([pa, pb].map(paraLL), { color: '#F2B73D', weight: 3, interactive: false }).addTo(g.campo);
      ([['A', pa], ['B', pb]] as [string, Coord][]).forEach(([letra, c]) => {
        const el2 = document.createElement('div');
        el2.textContent = letra;
        el2.style.cssText = 'width:24px;height:24px;border-radius:50%;background:#F2B73D;color:#2B1D00;border:2px solid #fff;font:600 12px Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;';
        L.marker(paraLL(c), { icon: L.divIcon({ html: el2, className: '', iconSize: [0, 0] }), interactive: false, zIndexOffset: 800 }).addTo(g.campo);
      });
    }
    if (props.linhaGuia) L.polyline(props.linhaGuia.map(paraLL), { color: '#F2B73D', weight: 3, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(g.campo);
    if (props.linhaGuia && props.linhaGuia.length === 2) {
      // seta grande saindo de você em direção à bandeirinha (a ponta aponta o caminho)
      const [de, para] = props.linhaGuia.map((c) => L.latLng(paraLL(c)));
      const m0 = mapa.current;
      if (m0) {
        const pa = m0.latLngToContainerPoint(de), pb = m0.latLngToContainerPoint(para);
        const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        if (dist > 70) {
          const f = Math.min(0.5, 60 / dist);
          const pos = L.latLng(de.lat + (para.lat - de.lat) * f, de.lng + (para.lng - de.lng) * f);
          const ang = Math.atan2(pb.x - pa.x, -(pb.y - pa.y)) * 180 / Math.PI;
          const seta = document.createElement('div');
          seta.style.cssText = `width:44px;height:44px;transform:rotate(${ang}deg);filter:drop-shadow(0 2px 5px rgba(0,0,0,.7));`;
          seta.innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44"><path d="M12 2 L21 20 L12 15.5 L3 20 Z" fill="#F2B73D" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
          L.marker(pos, { icon: L.divIcon({ html: seta, className: '', iconSize: [44, 44], iconAnchor: [22, 22] }), interactive: false, keyboard: false }).addTo(g.campo);
        }
      }
    }
    redesenhar.current();
  }, [props.parcelas, props.bandeiras, props.linhaGuia, props.rastro]);

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
    // só executa quando o comando é novo (número n); antes qualquer re-render do GPS refazia o enquadramento e o zoom "voltava"
  }, [props.comando?.n]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      <div ref={el} style={{ width: '100%', height: '100%', background: '#1b2a21' }} />
    </View>
  );
}
