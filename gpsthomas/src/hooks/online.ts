import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Há internet? (o navegador avisa quando a conexão cai ou volta) */
export function useOnline(): boolean {
  const ler = () => (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
  const [online, setOnline] = useState(ler);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(ler());
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
