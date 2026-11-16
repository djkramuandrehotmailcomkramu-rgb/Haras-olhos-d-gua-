import type { Coord } from '../geo/medidas';

export type Lugar = { nome: string; sub: string; coord: Coord };

const BASE = process.env.EXPO_PUBLIC_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';

export function interpretarNominatim(json: any): Lugar[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((x: any): Lugar | null => {
      const lat = Number(x.lat), lon = Number(x.lon);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      const partes = String(x.display_name ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const nome = String(x.name || partes[0] || 'Local sem nome');
      const resto = partes.filter((p) => p !== nome);
      return { nome, sub: resto.slice(0, 3).join(', '), coord: [lon, lat] };
    })
    .filter((x): x is Lugar => x !== null);
}

/** Busca endereços, cidades, rodovias e lugares em todo o Brasil (OpenStreetMap). */
export async function buscarLugar(texto: string, perto?: Coord, sinal?: AbortSignal): Promise<Lugar[]> {
  const q = new URLSearchParams({ format: 'jsonv2', q: texto, limit: '7', countrycodes: 'br', 'accept-language': 'pt-BR', addressdetails: '0' });
  if (perto) {
    const d = 1.5;
    q.set('viewbox', `${perto[0] - d},${perto[1] + d},${perto[0] + d},${perto[1] - d}`);
  }
  const r = await fetch(`${BASE}/search?${q}`, { signal: sinal });
  if (!r.ok) throw new Error(`Busca respondeu ${r.status}`);
  return interpretarNominatim(await r.json());
}
