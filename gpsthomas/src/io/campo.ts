import type { PlanoCampo } from '../store/dados';
import { fecharAnel } from '../geo/medidas';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const coords = (pts: [number, number][]) => pts.map((c) => `${c[0]},${c[1]},0`).join(' ');
type NomeTalhao = (id: string) => string;

const rotuloParte = (p: PlanoCampo['partes'][number], n: NomeTalhao) => `${p.variedade || 'Sem variedade'} (${n(p.talhaoId)} · parte ${p.indice + 1})`;

export function paraKMLCampo(plano: PlanoCampo, n: NomeTalhao): string {
  const partes = plano.partes.flatMap((p) =>
    p.pedacos.map((anel) =>
      `<Placemark><name>${esc(rotuloParte(p, n))}</name><description>${esc(`${(p.areaM2 / 10000).toFixed(2)} ha`)}</description><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(fecharAnel(anel))}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`,
    ),
  );
  const bandeiras = plano.bandeiras.map((b) => `<Placemark><name>${esc(b.rotulo)}</name><Point><coordinates>${b.coord[0]},${b.coord[1]},0</coordinates></Point></Placemark>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(plano.nome)}</name>\n${[...partes, ...bandeiras].join('\n')}\n</Document></kml>\n`;
}

export function paraGeoJSONCampo(plano: PlanoCampo, n: NomeTalhao): string {
  const feats: any[] = plano.partes.flatMap((p) =>
    p.pedacos.map((anel) => ({
      type: 'Feature',
      properties: { nome: rotuloParte(p, n), variedade: p.variedade, talhao: n(p.talhaoId), parte: p.indice + 1, area_ha: +(p.areaM2 / 10000).toFixed(3) },
      geometry: { type: 'Polygon', coordinates: [fecharAnel(anel)] },
    })),
  );
  plano.bandeiras.forEach((b) => feats.push({ type: 'Feature', properties: { nome: b.rotulo, colocada: b.colocada }, geometry: { type: 'Point', coordinates: b.coord } }));
  return JSON.stringify({ type: 'FeatureCollection', features: feats }, null, 2);
}

export function pontosExport(plano: PlanoCampo): string {
  const w = plano.bandeiras.map((b) => `<wpt lat="${b.coord[1]}" lon="${b.coord[0]}"><name>${esc(b.rotulo)}</name></wpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GPSThomas" xmlns="http://www.topografix.com/GPX/1/1">\n${w}\n</gpx>\n`;
}

export function paraCSV2(plano: PlanoCampo, n: NomeTalhao): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhas = plano.partes.map((p) => [q(p.variedade || ''), q(n(p.talhaoId)), p.indice + 1, (p.areaM2 / 10000).toFixed(3).replace('.', ',')].join(';'));
  return ['variedade;talhao;parte;area_ha', ...linhas].join('\n') + '\n';
}
