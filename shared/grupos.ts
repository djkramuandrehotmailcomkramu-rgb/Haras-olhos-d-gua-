export interface Ponto {
  id: string;
  lat: number;
  lon: number;
}

export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface GrupoPontos {
  id: string;
  lat: number;
  lon: number;
  ids: string[];
}

/** Agrupa por proximidade: cada ponto entra no primeiro grupo cujo centro está a ≤ km. Determinístico (ordena por id). */
export function agrupar(pontos: Ponto[], km: number): GrupoPontos[] {
  const grupos: GrupoPontos[] = [];
  const ord = [...pontos].sort((a, b) => a.lat - b.lat || a.lon - b.lon || a.id.localeCompare(b.id));
  for (const p of ord) {
    const g = grupos.find((x) => distKm(x, p) <= km);
    if (g) {
      g.ids.push(p.id);
      const n = g.ids.length;
      g.lat += (p.lat - g.lat) / n;
      g.lon += (p.lon - g.lon) / n;
    } else {
      grupos.push({ id: '', lat: p.lat, lon: p.lon, ids: [p.id] });
    }
  }
  grupos.forEach((g, i) => {
    g.id = `g${i + 1}`;
    g.lat = Math.round(g.lat * 1e4) / 1e4;
    g.lon = Math.round(g.lon * 1e4) / 1e4;
  });
  return grupos;
}
