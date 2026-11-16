import type { Coord } from '../geo/medidas';

export type Passo = {
  tipo: string;
  modificador?: string;
  nome: string;
  distanciaM: number;
  duracaoS: number;
  local: Coord;
  saida?: number;
  /** distância acumulada (m) em que a manobra acontece */
  inicioM: number;
  texto: string;
};

export type Rota = {
  distanciaM: number;
  duracaoS: number;
  geometria: Coord[];
  passos: Passo[];
  /** "via BR-163", a via mais longa da rota */
  via: string;
  /** limite de velocidade (km/h) de cada trecho da geometria, quando conhecido */
  limites?: (number | null)[];
};

/** Servidor de rotas. Troque por um próprio ou pago definindo EXPO_PUBLIC_OSRM_URL. */
const BASE = process.env.EXPO_PUBLIC_OSRM_URL ?? 'https://router.project-osrm.org';

const DIR: Record<string, string> = {
  right: 'à direita',
  'sharp right': 'acentuadamente à direita',
  'slight right': 'levemente à direita',
  left: 'à esquerda',
  'sharp left': 'acentuadamente à esquerda',
  'slight left': 'levemente à esquerda',
  straight: 'em frente',
};

/** Texto da manobra em português. */
export function textoPasso(tipo: string, modificador: string | undefined, nome: string, saida?: number): string {
  const em = nome ? ` em ${nome}` : '';
  const dir = modificador ? DIR[modificador] : undefined;
  switch (tipo) {
    case 'depart':
      return nome ? `Siga em frente por ${nome}` : 'Siga em frente';
    case 'arrive':
      return modificador === 'left' ? 'Você chegou. O destino está à esquerda' : modificador === 'right' ? 'Você chegou. O destino está à direita' : 'Você chegou ao destino';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return saida ? `Na rotatória, pegue a ${saida}ª saída${em}` : `Entre na rotatória${em}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Saia da rotatória${em}`;
    case 'fork':
      return dir ? `Mantenha-se ${dir}${em}` : `Siga pela bifurcação${em}`;
    case 'merge':
      return `Entre na via${em}`;
    case 'on ramp':
      return `Pegue a entrada${dir ? ' ' + dir : ''}${em}`;
    case 'off ramp':
      return `Pegue a saída${dir ? ' ' + dir : ''}${em}`;
    case 'end of road':
      return modificador === 'uturn' ? 'No fim da via, faça o retorno' : dir ? `No fim da via, vire ${dir}${em}` : `No fim da via${em}`;
    case 'continue':
    case 'new name':
      return modificador && modificador !== 'straight' && dir ? `Continue ${dir}${em}` : `Continue${em || ' em frente'}`;
    case 'turn':
    default:
      if (modificador === 'uturn') return 'Faça o retorno';
      if (modificador === 'straight' || !dir) return `Siga em frente${em}`;
      return `Vire ${dir}${em}`;
  }
}

/** Transforma a resposta do OSRM em rotas do app. */
export function interpretarOSRM(json: any): Rota[] {
  if (!json || json.code !== 'Ok' || !Array.isArray(json.routes)) return [];
  return json.routes.map((r: any): Rota => {
    const geometria: Coord[] = (r.geometry?.coordinates ?? []).map((c: number[]) => [c[0], c[1]] as Coord);
    const passos: Passo[] = [];
    let acum = 0;
    const longo = { d: -1, nome: '' };
    for (const leg of r.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const nome = String(s.ref || s.name || '').trim();
        const m = s.maneuver ?? {};
        passos.push({
          tipo: m.type ?? 'turn',
          modificador: m.modifier,
          nome,
          distanciaM: s.distance ?? 0,
          duracaoS: s.duration ?? 0,
          local: [m.location?.[0] ?? 0, m.location?.[1] ?? 0],
          saida: m.exit,
          inicioM: acum,
          texto: textoPasso(m.type ?? 'turn', m.modifier, nome, m.exit),
        });
        acum += s.distance ?? 0;
        if (nome && (s.distance ?? 0) > longo.d) { longo.d = s.distance ?? 0; longo.nome = nome; }
      }
    }
    const limites: (number | null)[] = [];
    for (const leg of r.legs ?? []) {
      for (const m of leg.annotation?.maxspeed ?? []) limites.push(typeof m?.speed === 'number' && m.speed > 0 ? m.speed : null);
    }
    return {
      distanciaM: r.distance ?? 0, duracaoS: r.duration ?? 0, geometria, passos, via: longo.nome ? `via ${longo.nome}` : '',
      limites: limites.length ? limites : undefined,
    };
  });
}

export async function calcularRotas(origem: Coord, destino: Coord, sinal?: AbortSignal): Promise<Rota[]> {
  const url = `${BASE}/route/v1/driving/${origem[0]},${origem[1]};${destino[0]},${destino[1]}?overview=full&geometries=geojson&steps=true&alternatives=3`;
  // Tenta com o limite de velocidade das vias; se o servidor não aceitar, refaz sem ele.
  let r = await fetch(`${url}&annotations=maxspeed`, { signal: sinal });
  if (r.status === 400) r = await fetch(url, { signal: sinal });
  if (!r.ok) throw new Error(`Servidor de rotas respondeu ${r.status}`);
  const rotas = interpretarOSRM(await r.json());
  if (rotas.length === 0) throw new Error('Nenhuma rota encontrada entre esses pontos');
  return rotas;
}
