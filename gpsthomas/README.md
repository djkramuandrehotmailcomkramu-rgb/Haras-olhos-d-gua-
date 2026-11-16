# GPSThomas

App GPS para medir área e distância no campo (React Native + Expo, Android).

## Rodar
```bash
cd gpsthomas
npm install --legacy-peer-deps
npx expo start
```
Fase 1 roda no Expo Go. Mapa de satélite e GPS em segundo plano (fases 2 e 5) exigem dev build:
`eas build --profile development --platform android`.

## Verificar
```bash
npm run typecheck
npm test
```

## Fases
1. Base e design system (esta) · 2. Medição · 3. Fazendas e talhões · 4. Importar/exportar · 5. Offline + nuvem · 6. Solo, plantio e colheita.
