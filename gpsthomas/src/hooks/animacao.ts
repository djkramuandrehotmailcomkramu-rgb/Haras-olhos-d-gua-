import { useEffect, useRef, useState } from 'react';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/** Entrada suave (fade + leve subida) toda vez que a tela ganha foco. Respeita "reduzir movimento". */
export function useEntradaFoco() {
  const reduzir = useReducedMotion();
  const p = useSharedValue(reduzir ? 1 : 0);
  useFocusEffect(
    useCallback(() => {
      if (reduzir) { p.value = 1; return; }
      p.value = 0;
      p.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    }, [reduzir]),
  );
  return useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 10 }] }));
}

/** Número que "rola" suavemente até o novo valor. */
export function useNumeroAnimado(alvo: number, duracaoMs = 320) {
  const [v, setV] = useState(alvo);
  const de = useRef(alvo);
  const raf = useRef<number | null>(null);
  const reduzir = useReducedMotion();
  useEffect(() => {
    if (reduzir || Math.abs(alvo - de.current) < 1e-9) { de.current = alvo; setV(alvo); return; }
    const ini = performance.now();
    const origem = de.current;
    const passo = (agora: number) => {
      const k = Math.min(1, (agora - ini) / duracaoMs);
      const e = 1 - Math.pow(1 - k, 3);
      const atual = origem + (alvo - origem) * e;
      de.current = atual;
      setV(atual);
      if (k < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [alvo]);
  return v;
}
