import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Raiz({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="theme-color" content="#1F7A3E" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GPSThomas" />
        <style dangerouslySetInnerHTML={{ __html: `html,body{background:#F1F4EF;overscroll-behavior:none}@media (prefers-color-scheme:dark){html,body{background:#0A110D}}body{-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased}` }} />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
