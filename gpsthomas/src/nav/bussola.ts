import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Bússola do celular (web): rumo para onde o aparelho aponta, 0 = norte.
 * Em iPhone pede permissão ao primeiro toque; no Android funciona direto.
 */
export function useBussola(ativa: boolean) {
  const [rumo, setRumo] = useState<number | null>(null);
  const [precisaPermissao, setPrecisaPermissao] = useState(false);
  const ultimo = useRef<number | null>(null);

  const ouvir = () => {
    const tratar = (e: any) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS
      else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360; // Android (deviceorientationabsolute)
      if (h == null || !isFinite(h)) return;
      // suaviza para a seta não tremer
      const ant = ultimo.current;
      const suave = ant == null ? h : (ant + (((h - ant + 540) % 360) - 180) * 0.25 + 360) % 360;
      ultimo.current = suave;
      setRumo(suave);
    };
    window.addEventListener('deviceorientationabsolute' as any, tratar, true);
    window.addEventListener('deviceorientation' as any, (e: any) => { if (typeof e.webkitCompassHeading === 'number') tratar(e); }, true);
    return () => window.removeEventListener('deviceorientationabsolute' as any, tratar, true);
  };

  useEffect(() => {
    if (!ativa || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const D: any = (window as any).DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') { setPrecisaPermissao(true); return; }
    return ouvir();
  }, [ativa]);

  const pedirPermissao = async () => {
    try {
      const D: any = (window as any).DeviceOrientationEvent;
      if (D?.requestPermission && (await D.requestPermission()) === 'granted') { setPrecisaPermissao(false); ouvir(); }
    } catch {}
  };

  return { rumo, precisaPermissao, pedirPermissao };
}
