import type { ComponentChildren } from 'preact';

const I = ({ children, size = 24 }: { children: ComponentChildren; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);
type P = { size?: number };
export const IcGota = (p: P) => <I {...p}><path d="M12 3c3.5 4.6 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.4 6-11z" /></I>;
export const IcCalendario = (p: P) => <I {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></I>;
export const IcGrade = (p: P) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></I>;
export const IcMapa = (p: P) => <I {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></I>;
export const IcRegua = (p: P) => <I {...p}><path d="M7 3h10l-1 18H8L7 3z" /><path d="M9 8h3M9 12h3M9 16h3" /></I>;
export const IcGrafico = (p: P) => <I {...p}><path d="M3 20h18M6 16v-5M11 16V6M16 16v-8" /></I>;
export const IcEngrenagem = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>;
export const IcSpray = (p: P) => <I {...p}><path d="M5 11h8v9H5zM7 11V7h4v4M11 5h4M17 7l3-1M17 10h3M17 13l3 1" /></I>;
export const IcSemente = (p: P) => <I {...p}><path d="M12 21V11M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z" /></I>;
export const IcColheita = (p: P) => <I {...p}><path d="M3 17h13l2-6h3M7 17V8h6v9" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></I>;
export const IcWifiOff = (p: P) => <I {...p}><path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5-2.7M13.5 10.3a10 10 0 0 1 5.5 2.6M12 20h.01" /></I>;
export const IcAtualizar = (p: P) => <I {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></I>;
export const IcCompartilhar = (p: P) => <I {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></I>;
export const IcPino = (p: P) => <I {...p}><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></I>;
export const IcAlerta = (p: P) => <I {...p}><path d="M12 3 2 20h20L12 3zM12 10v5M12 18h.01" /></I>;
export const IcLixeira = (p: P) => <I {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></I>;
export const IcCamera = (p: P) => <I {...p}><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const IcBaixar = (p: P) => <I {...p}><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></I>;
export const IcPlay = (p: P) => <I {...p}><path d="M7 4v16l13-8z" /></I>;
export const IcPausa = (p: P) => <I {...p}><path d="M7 4h3v16H7zM14 4h3v16h-3z" /></I>;
export const IcRadar = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 19 5" /></I>;
export const IcSino = (p: P) => <I {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></I>;
export const IcBusca = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></I>;
export const IcAjuda = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01" /></I>;
export const IcMais = (p: P) => <I {...p}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></I>;
