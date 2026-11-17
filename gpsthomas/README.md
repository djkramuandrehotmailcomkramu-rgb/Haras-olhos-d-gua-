# GPSThomas 1.0.0

App GPS para medir área e distância no campo (React Native + Expo). Roda como PWA no Android/iPhone e, nas próximas fases, como app nativo.

## Funciona hoje
- Mapa de satélite (Esri) e mapa de ruas, com GPS e precisão em tempo real
- Medir por **caminhada** (GPS grava o contorno), **pontos no mapa** (arrastáveis) e **distância**
- Área, perímetro e distância ao vivo; hectare, alqueires (paulista, mineiro, goiano, baiano) e m²
- Talhões por fazenda, cultura e safra; busca; edição e exclusão
- Histórico de medições, conversão de medição em talhão
- Importar KML, KMZ, GeoJSON ou GPX e exportar KML / GeoJSON / GPX / CSV
- Dados salvos no aparelho; mapas já vistos abrem sem internet

## Rodar
```bash
cd gpsthomas
npm install --legacy-peer-deps
npx expo start --web
```

## Verificar
```bash
npm run typecheck && npm test
```

## Próximas fases
Nuvem (Supabase) e backup · análise de solo (pontos de coleta, laudos) · plantio e colheita · relatórios PDF · app nativo com GPS em segundo plano.

## Campo de sementes (v0.6)
Importe o KML/KMZ dos talhões, divida cada um em partes de área igual (faixas paralelas ao lado mais longo), distribua as variedades e use o guia para ir até cada ponto de divisa e fincar a bandeirinha. Exporta KML, GeoJSON, GPX (bandeiras) e CSV.

## v0.7
PDF do plano do campo de sementes (mapa vetorial, partes, variedades e bandeirinhas com link do Google Maps), toque na bandeirinha para ser guiado até ela (a pé ou por estrada), painéis recolhíveis para ver o mapa limpo, mapa em tela cheia e rolagem com efeito suave.
`npx tsx tools/gerar-pdf-exemplo.ts saida.pdf` gera um PDF de exemplo.


## Verificar antes de publicar
```bash
npm run typecheck && npm test            # tipos e 80 testes
npm run build:web                        # gera dist/
NODE_PATH=$(npm root -g) npm run e2e     # 15 cenários de ponta a ponta (precisa de Playwright)
NODE_PATH=$(npm root -g) npm run auditoria   # axe-core + capturas de tela
```
Veja `CHECKLIST.md` (resultado de cada item) e `CHANGELOG.md`.

## Serviços externos (configuráveis)
`EXPO_PUBLIC_OSRM_URL` (rotas) e `EXPO_PUBLIC_NOMINATIM_URL` (busca). Os padrões são servidores públicos gratuitos para uso leve.
