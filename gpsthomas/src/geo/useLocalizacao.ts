import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coord } from './medidas';

export type Posicao = { coord: Coord; precisaoM: number | null; velocidade: number | null; rumo: number | null; tempoMs: number };

/** Liga/desliga o GPS e entrega a última posição. */
export function useLocalizacao() {
  const [pos, setPos] = useState<Posicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ligado, setLigado] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const tentando = useRef(false);

  const ligar = useCallback(async () => {
    if (sub.current || tentando.current) return;
    tentando.current = true;
    setErro(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setErro('Permissão de localização negada. Libere o GPS nas configurações do navegador/app.');
        return;
      }
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
        (l) => {
          setPos({
            coord: [l.coords.longitude, l.coords.latitude],
            precisaoM: l.coords.accuracy ?? null,
            velocidade: l.coords.speed != null && isFinite(l.coords.speed) && l.coords.speed >= 0 ? l.coords.speed : null,
            rumo: l.coords.heading != null && isFinite(l.coords.heading) && l.coords.heading >= 0 ? l.coords.heading : null,
            tempoMs: l.timestamp,
          });
        },
      );
      setLigado(true);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível obter o GPS.');
    } finally {
      tentando.current = false;
    }
  }, []);

  const desligar = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    setLigado(false);
  }, []);

  useEffect(() => () => { sub.current?.remove(); }, []);

  return { pos, erro, ligado, ligar, desligar };
}
