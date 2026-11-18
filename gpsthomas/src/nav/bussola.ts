import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const RAD = Math.PI / 180;

/**
 * Rumo magnético (0 = norte, sentido horário) para onde o celular aponta, com compensação de inclinação.
 * Soma as projeções horizontais da borda de cima e da parte de trás do aparelho: vale deitado, inclinado ou em pé.
 * `anguloTelaGraus` é a rotação da tela (0 em retrato).
 */
export function rumoDaOrientacao(alpha: number, beta: number, gamma: number, anguloTelaGraus = 0): number {
  const a = alpha * RAD, b = beta * RAD, g = gamma * RAD;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  // borda de cima do aparelho (leste, norte)
  const topoL = -sA * cB, topoN = cA * cB;
  // parte de trás do aparelho (leste, norte)
  const trasL = -cA * sG - sA * sB * cG, trasN = -sA * sG + cA * sB * cG;
  const h = Math.atan2(topoL + trasL, topoN + trasN) / RAD;
  return (((h + anguloTelaGraus) % 360) + 360) % 360;
}

/** Média circular suave: aproxima `atual` de `novo` pelo menor arco. */
export function suavizarCircular(atual: number | null, novo: number, fator = 0.2): number {
  if (atual == null) return novo;
  const d = ((novo - atual + 540) % 360) - 180;
  return (atual + d * fator + 360) % 360;
}

const anguloDaTela = (): number => {
  try { return (typeof screen !== 'undefined' && (screen as any).orientation?.angle) || 0; } catch { return 0; }
};

/**
 * Bússola do celular (web/WebView): rumo MAGNÉTICO para onde o aparelho aponta, já suavizado.
 * Em iPhone pede permissão ao primeiro toque; no Android funciona direto.
 */
export function useBussola(ativa: boolean) {
  const [rumo, setRumo] = useState<number | null>(null);
  const [precisaPermissao, setPrecisaPermissao] = useState(false);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const ultimo = useRef<number | null>(null);
  const parar = useRef<(() => void) | null>(null);

  const ouvir = () => {
    parar.current?.();
    const tratar = (e: any, soAbsoluto: boolean) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') h = (e.webkitCompassHeading + anguloDaTela() + 360) % 360; // iOS
      else if ((!soAbsoluto || e.absolute) && typeof e.alpha === 'number' && typeof e.beta === 'number' && typeof e.gamma === 'number') {
        if (!soAbsoluto && !e.absolute) return; // sem referência do norte: não serve
        h = rumoDaOrientacao(e.alpha, e.beta, e.gamma, anguloDaTela());
      }
      if (h == null || !isFinite(h)) return;
      const suave = suavizarCircular(ultimo.current, h, 0.18);
      ultimo.current = suave;
      setDisponivel(true);
      setRumo(suave);
    };
    const abs = (e: any) => tratar(e, true);
    const rel = (e: any) => tratar(e, true); // `deviceorientation` só vale quando `absolute` ou no iOS
    window.addEventListener('deviceorientationabsolute' as any, abs, true);
    window.addEventListener('deviceorientation' as any, rel, true);
    parar.current = () => {
      window.removeEventListener('deviceorientationabsolute' as any, abs, true);
      window.removeEventListener('deviceorientation' as any, rel, true);
      parar.current = null;
    };
    // se nada chegar em 2,5 s, o aparelho não tem bússola utilizável
    const t = setTimeout(() => setDisponivel((d) => (d === null ? false : d)), 2500);
    const antes = parar.current;
    parar.current = () => { clearTimeout(t); antes?.(); };
  };

  useEffect(() => {
    if (!ativa || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const D: any = (window as any).DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') { setPrecisaPermissao(true); return () => parar.current?.(); }
    ouvir();
    return () => parar.current?.();
  }, [ativa]);

  const pedirPermissao = async () => {
    try {
      const D: any = (window as any).DeviceOrientationEvent;
      if (D?.requestPermission && (await D.requestPermission()) === 'granted') { setPrecisaPermissao(false); ouvir(); }
    } catch {}
  };

  return { rumo, precisaPermissao, pedirPermissao, disponivel };
}
