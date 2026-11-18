# GPSThomas 1.3.0: checklist de entrega

Resultado de cada item na versão 1.0.0. `[x]` = verificado automaticamente aqui; `[~]` = verificado só em parte; `[ ]` = não dá para verificar neste ambiente (precisa do seu aparelho ou de serviço externo).

## 1. Medir e talhões
- [x] Medir por pontos no mapa, por caminhada (GPS) e por distância; área, perímetro e unidades (ha, alqueires, m²)
- [x] Área calculada sobre o elipsoide: quadrado de 100 m × 100 m = 1 ha (teste unitário)
- [x] Salvar como talhão ou só medição; editar, buscar, excluir
- [x] Importar KML, KMZ, GeoJSON e GPX (ordem do arquivo preservada, nome da fazenda, aviso de buracos)
- [x] Exportar KML, GeoJSON, GPX e CSV
- [x] **Ajuste de precisão**: selecionar ponto, alça ao lado (1×, ½×, ¼×), setas (0,5/1/5 m), remover, tela de 360 px
- [x] **Modo Mira** (cruz no centro, marcar no centro, prévia da área)
- [ ] Caminhada com GPS real no campo (precisa do celular)

## 2. Campo de sementes
- [x] Divisão em partes iguais com faixas paralelas ao lado mais longo (92 ha → 5 × 18,36 ha; 72 ha → 6 × 11,97 ha)
- [x] **Hectares digitados à mão**: vírgula decimal, última parte = o que sobra, "X ha cada", igualar, limpar, validação "passou da área", calibração pela área informada
- [x] Talhões côncavos (em L) e polígonos de 2.000 vértices (divisão em 80 ms)
- [x] Corredor entre partes e conferência de áreas (soma × talhão, alerta > 0,5%)
- [x] Variedades, uma variedade em 2 partes, meta por variedade com selo na meta / fora
- [x] Ajustar hectares de um plano existente mantendo variedades e bandeirinhas já colocadas
- [x] Bandeirinhas: toque no mapa ou na lista, guia (distância, seta, desvio da linha), "Chegou" a 3 m, confirmar, voltar à ordem automática
- [x] PDF do plano (mapa vetorial, partes, variedades, meta, conferência, bandeirinhas com link)
- [~] Bússola do celular (lógica testada; depende do sensor do aparelho)

## 3. Rotas e navegação
- [x] Busca de endereço, até 3 rotas, navegação com banner, voz, recálculo, chegada (serviços simulados)
- [x] Velocímetro, ícone do veículo girando, limite da via, alerta de excesso, histórico de viagens
- [ ] Busca e rotas com os servidores reais (Nominatim/OSRM) e GPS em movimento de verdade

## 4. Dados e segurança
- [x] Dados versionados (`version 1`) com migração; dados antigos (v0) abrem sem perda
- [x] Backup completo `.json` e restauração com validação (Zod); backup inválido não apaga nada
- [x] Lembrete de backup (nunca feito / mais de 30 dias)
- [x] Armazenamento persistente solicitado ao navegador; status em Ajuda e sobre
- [x] Tela de erro global com opção de backup (sem tela branca)
- [x] Nenhum segredo no código; localização fica no aparelho

## 5. Instalação (PWA)
- [x] `index.html` com idioma pt-BR, manifest, ícones 192/512/maskable, atalhos (Medir, Rotas, Talhões), service worker
- [x] App abre sem internet; mapas já vistos ficam em cache; aviso de "sem internet"
- [x] Aviso "Nova versão disponível" com botão Atualizar
- [x] Botão Tela cheia (Mais), tela cheia ao recolher o painel, aviso e botão de instalar (testado com o pedido de instalação simulado)
- [ ] Instalar na tela inicial do seu Android e conferir o ícone (remova antes o atalho antigo: a barra verde é do atalho, não do app instalado)

> Atenção: até a v0.7 o `index.html` do modo web não incluía o manifest nem o service worker (o `+html.tsx` não é usado no modo `single`). Isso foi corrigido na 1.0.0 com `public/index.html`.

## 6. Acessibilidade e interface
- [x] axe-core (WCAG 2.0 A/AA): 0 violações em 11 telas × 360/412/768 px × claro/escuro
- [x] Lighthouse acessibilidade 100; alvos de toque ≥ 44 px; zoom liberado; contraste AA nos dois temas
- [x] Rolagem suave, cartões que aparecem ao rolar, paralaxe, painéis recolhíveis, esmaecido "há mais conteúdo"
- [x] Dicas "?" em Área, Perímetro, Corredor, Área informada e Meta; guia rápido em Ajuda e sobre
- [x] `prefers-reduced-motion` respeitado

## 7. Desempenho (Lighthouse, celular lento simulado, com compressão como na Vercel)
| Métrica | Antes | 1.0.0 |
|---|---|---|
| Peso total | 5,2 MB | **961 KB** |
| Primeira pintura | 10,4 s | **0,8 s** |
| Maior pintura (LCP) | 30,3 s | 6,8 s |
| Tempo bloqueado (TBT) | 660 ms | 750 ms |
| Nota de desempenho | 39 | 58 |
| Acessibilidade / Boas práticas / SEO | 100 / 96 / 82 | **100 / 96 / 100** |

Fontes reduzidas de 4 × 335 KB para 4 × 16 KB. Em celular real o tempo é bem menor que no modo simulado, mas o JavaScript do aplicativo (≈ 900 KB comprimido) ainda é a maior parte do custo.

## 8. Testes automatizados
- [x] `npm run typecheck` sem erros
- [x] `npm test`: 80 testes (geometria, divisão, hectares digitados, formatos, backup, navegação, PDF, desempenho)
- [x] `npm run e2e`: 19 cenários de ponta a ponta (importar, medir, campo, hectares digitados, ajustar, meta, PDF, bandeirinha, rotas, painéis, backup, ajuda, migração, PWA offline, aviso de versão)
- [x] `npm run auditoria`: axe-core + capturas em 3 larguras e 2 temas (`e2e/saida/telas`)

## 9. Limites conhecidos (não são defeitos)
- GPS de celular erra de 3 a 10 m (em faixa de 400 m, 5 m ≈ 1,2% da área). Precisão de centímetros exige receptor GNSS/RTK externo.
- No navegador o GPS pára com a tela apagada; GPS em segundo plano exigiria um app nativo (tentamos um APK, mas foi abandonado: o PWA é o caminho oficial).
- Servidores públicos gratuitos (mapas Esri/OSM, busca Nominatim, rotas OSRM) são para uso leve e podem limitar. Para uso intenso, usar servidor próprio/chave (`EXPO_PUBLIC_OSRM_URL`, `EXPO_PUBLIC_NOMINATIM_URL`).
- Dados só neste aparelho (sem conta/nuvem): use o backup.
- Sem trânsito em tempo real, pedágio ou radar; rotas só de carro.
- PDF e revelação ao rolar só na versão web.

## 10. Pendências sugeridas
1. APK Android (EAS Build) com GPS em segundo plano e mapas offline.
2. Backup na nuvem com login (Supabase) e uso em vários aparelhos.
3. Servidor de rotas próprio ou chave (OpenRouteService) para uso intenso.
4. Análise de solo (pontos de coleta, grade amostral, laudos).
5. Mesclar a branch de trabalho na `main` para a publicação automática.

## 11. Como atualizar
```bash
cd gpsthomas
npm install --legacy-peer-deps
npm run typecheck && npm test
npm run build:web && NODE_PATH=$(npm root -g) npm run e2e
```
Publicação: Vercel (projeto `gpsthomas`, raiz `gpsthomas/`, `vercel.json` já configurado).

## 1.2.0 — instalação, ícone e abertura
- [x] Build instalável localmente (CDP `getInstallabilityErrors` vazio; manifest, SW, ícones 192/512/maskable/monochrome)
- [x] Diagnóstico "Verificar a instalação" (detecta 401/HTML de site protegido por login)
- [x] Ícone v2 versionado e abertura animada (e2e: 21/21; axe: 0 violações; tsc e jest 81/81 verdes)
- [ ] **Pendente (Vercel):** desativar a proteção de login em produção (só pré-visualizações) para o Chrome conseguir baixar manifest/ícones
- [ ] Não testado aqui: instalação em celular real e acesso público real à Vercel
