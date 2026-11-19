/** Fontes de mapa: usadas pelo mapa na tela e pelo download offline (as URLs precisam ser idênticas). */
export type CamadaId = 'satelite' | 'mapa';

export const CAMADAS = {
  satelite: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    rotulos: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagens © Esri, Maxar, Earthstar Geographics',
    /** tamanho médio de um bloco (KB): imagem + rótulos */
    kbPorTile: 26,
  },
  mapa: { base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', rotulos: null, attr: '© OpenStreetMap', kbPorTile: 14 },
} as const;

export const ZOOM_NATIVO_MAX = 19;
