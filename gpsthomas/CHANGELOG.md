# Changelog

## 1.9.0
- **Mapas offline:** novo botão de nuvem no mapa (e em Mais ▸ Ajustes). Baixe a região da fazenda (ou só os talhões) em satélite ou ruas, com estimativa de tamanho, progresso, pausa e nova tentativa; o mapa abre sem internet com o que foi baixado. Armazenamento persistente pedido ao navegador. Gerencia e apaga áreas salvas.
- **Mapa mais limpo:** rótulos de talhões e partes só aparecem quando cabem e sem se sobrepor; as bandeirinhas de longe viram pontos e as que estão perto viram um número (toque para aproximar); a próxima bandeirinha do guia sempre aparece. O giro com dois dedos vem desligado (botão para ligar).
- **Interface no estilo iPhone:** listas agrupadas, controles segmentados, barra de abas com 4 itens, fonte Inter (a mais próxima da SF), cantos e bordas finas. A cor verde foi trocada por **índigo** (ícone, abertura, mapa, impressão e PDF).
- **Menos rolagem:** Mais virou 3 abas (Arquivos, Ajustes, Sistema); Talhões ganhou abas (Talhões, Campos de sementes) com linhas compactas; o mapa só mostra desfazer/refazer/limpar quando há pontos e dispensa dicas repetidas.

## 1.8.0
- **Volta ao PWA:** o APK (casca Android) foi **abandonado e removido** (instalação com conflitos, impressão e downloads instáveis). O app é o PWA instalado pelo Chrome (⋮ → Instalar app); a impressão e os downloads usam o navegador. Se você ainda tem o APK, desinstale.
- **GPS mais fiel andando:** o filtro agora é um Kalman de posição + velocidade: não fica "atrasado" ao caminhar (antes o ponto ficava ~3 m para trás e cortava curvas), suaviza o ruído parado e estima velocidade e rumo quando o navegador não informa (a seta do guia usa esse rumo).
- **Contorno que se cruza:** aviso na tela do campo de sementes quando o desenho de um talhão se cruza (área e divisão ficariam erradas).
- Ajuda atualizada com o passo a passo de instalação do PWA; testes aleatórios da divisão em vários talhões. 115 testes unitários e 24 ponta a ponta.

## 1.7.0
- **Guia das bandeirinhas mais preciso:** o GPS passa por um filtro que pesa cada leitura pela precisão informada (o primeiro sinal ruim, de ±100 m ou mais, deixa de bagunçar a distância); enquanto a precisão estiver pior que 15 m o guia espera ("Aguardando GPS preciso") em vez de mostrar seta e distâncias falsas; o GPS já liga ao abrir o plano.
- **Seta certa:** a bússola agora compensa a inclinação do celular (andando com ele em pé ou inclinado) e a rotação da tela, e converte o norte magnético em norte verdadeiro (no Brasil a diferença é de 15° a 24°). Andando, a seta usa a direção do GPS; parado, a bússola. A seta gira suave, pelo menor caminho.
- **Calibrar bússola:** o app aprende o desvio andando em linha reta (botão para fazer na hora).
- **Calibrar GPS:** ajuste por ponto conhecido (ponto A/B da linha do monitor, última bandeira ou coordenadas digitadas), válido por 3 horas.
- **"Chegou" estável:** só depois de 3 leituras boas seguidas; sai acima de 5 m.
- Testes: 114 unitários e 25 ponta a ponta.

## 1.6.2
- **APK:** novo identificador do app (`br.com.gpsthomas.campo`) para instalar sem "conflito com pacote existente", e **chave de assinatura fixa**: de agora em diante todo APK novo instala por cima do anterior sem desinstalar (o conflito acontecia porque cada APK era assinado com uma chave diferente). O app antigo (se ainda existir em algum espaço do celular) pode ser removido depois.

## 1.6.1
- **Correção no app Android (APK):** "Imprimir plano" e "Baixar PDF" não funcionavam dentro do app. Agora a casca tem um plugin nativo (imprimir a página do plano e abrir a folha de compartilhar do Android para PDF, backup, KML, GeoJSON, GPX e CSV). A marca do app no navegador também foi corrigida (some o aviso "Instale o app" dentro do APK).
- **Ajuda → Verificar a instalação** mostra se o app Android e o plugin foram encontrados e ganhou **Testar impressão**.
- Erros de impressão/compartilhamento aparecem na tela com o motivo. É preciso **baixar o APK novo** (`/GPSThomas.apk`) e instalar por cima.

## 1.6.0
- **Imprimir plano:** o botão "Gerar PDF" virou **"Imprimir plano"** e abre direto a impressão (ou "Salvar como PDF") com o plano completo: mapa com a linha AB, partes, totais por variedade, conferência e bandeirinhas com link do Google Maps. "Baixar PDF" continua disponível.
- **App Android (APK):** nova ponte de impressão nativa; é preciso **baixar o APK novo** (`/GPSThomas.apk`) e instalar por cima para imprimir pelo app. No Chrome já funciona.
- Testes: 96 unitários e 23 ponta a ponta.

## 1.5.0
- **Campo de sementes com talhões juntos:** marque dois ou mais talhões (ex.: Andropgno e Amendoim) e ligue **"Plantar os talhões juntos"**: eles viram **um só campo**, dividido em partes iguais de X ha (ex.: 16 ha). As faixas atravessam todos os talhões e cada parte mostra quanto vem de cada um.
- **Rastro reto (linha AB do monitor):** digite os pontos A e B (ponto ou vírgula nos decimais); as divisas ficam **paralelas à linha**. A linha aparece no mapa (com A e B), no PDF e nas exportações (KML, GeoJSON, GPX).
- O que sobra depois das partes cheias vira uma **parte de sobra** (ou é repartido entre todas); área total informada opcional para calibrar; meta por variedade já preenchida com os hectares da parte.
- "Ajustar hectares" reabre o plano com tudo preenchido; backup e restauração guardam a configuração. Testes: 92 unitários e 22 ponta a ponta.

## 1.4.0
- **Girar o mapa:** gire com dois dedos para ver o terreno de qualquer lado (também funciona dando zoom ao mesmo tempo). Aparece uma **bússola** ao lado do painel; tocar nela volta o norte para cima. Pontos, alça de ajuste e toques continuam exatos com o mapa girado.
- Atualizações: o aplicativo (inclusive o APK) sempre abre a versão mais nova e avisa "Nova versão disponível — Atualizar"; também há **Ajuda → Verificar atualização**.

## 1.3.1
- **APK (casca Android em tela cheia):** projeto `casca/` (Capacitor) que abre o gpsthomas.vercel.app sem barra do navegador e com GPS; o GitHub Actions (`.github/workflows/apk.yml`) compila o APK de graça e o guarda em `public/GPSThomas.apk` (download em `/GPSThomas.apk`). O app reconhece a casca e não mostra mais o aviso "Instale o app".

## 1.3.0
- **Visual mais fino e moderno:** fontes um degrau mais leves em todo o app, ícones só de contorno (inclusive na barra de abas), bordas de 0,5 px em vez de sombras pesadas, cartões e botões mais baixos e arredondados, sombras suaves.
- **Mapa mais delicado:** linhas dos talhões, parcelas e rotas mais finas, pontos com borda leve (a área de toque continua grande).
- **Mais fluido:** animações de botões, indicador da barra de abas, entrada dos cartões e troca de telas com mola mais suave; cores e bordas mudam com transição.

## 1.2.0
- **Instalação do atalho corrigida na raiz:** o projeto na Vercel estava com *Deployment Protection* (login) e respondia 401 ao manifest, ao service worker e aos ícones, então o Chrome criava só um atalho comum (com a barra verde). Agora há **Ajuda → "Verificar a instalação"**, que testa HTTPS, manifest, ícones, service worker e modo de exibição e explica qualquer falha (inclusive site protegido por login).
- **Ícone novo** (símbolo maior, sombra no chão, degradê verde-soja), com arquivos versionados `icon-v2-*` para o Android não reaproveitar o ícone antigo; versões maskable e monocromática; `id` do manifest novo (reinstale o app).
- **Abertura animada sutil:** splash verde com o ícone surgindo, ondas suaves, título e saída com leve zoom/fade revelando o app; respeita "reduzir movimento".
- Testes de ponta a ponta: 21 cenários (2 novos).
- Para instalar: remova o atalho antigo, no Chrome use ⋮ → "Instalar app" e abra pelo ícone novo.

## 1.1.0
- **Ajuste de precisão do ponto:** toque num ponto para selecioná-lo; uma **alça laranja aparece ao lado** (ligada por uma linha pontilhada) e você arrasta a alça sem cobrir o ponto com o dedo. Fator da alça **1×, ½× ou ¼×** (¼× move o ponto 4 vezes menos), **setas** para mover 0,5 m, 1 m ou 5 m, remover ponto e "Pronto". O mapa leva o ponto sozinho para a área livre (fora dos painéis); toques seguidos nas setas contam como um único "desfazer".
- **Modo Mira:** uma cruz fixa no centro, o mapa anda por baixo e "Marcar no centro" põe o ponto exatamente ali, com prévia tracejada e da área enquanto você move o mapa.
- **Tela cheia e barra verde:** botão **Tela cheia** em Mais, tela cheia automática ao recolher o painel, aviso **"Instalar"** quando o app está aberto pelo navegador/atalho antigo e botão de instalação (a barra verde do endereço só some com o app instalado).
- Seletores de opção que sempre cabem na largura (telas de 360 px).
- Testes de ponta a ponta: 19 cenários (4 novos).

## 1.0.0
- **Hectares digitados** no campo de sementes (vírgula decimal, última parte = o que sobra, atalhos, calibração pela área informada) e **Ajustar hectares** em planos existentes.
- **Meta por variedade** com selo, resumo no topo do plano e **Conferência de áreas**.
- Divisão de talhões 20× mais rápida (2.000 vértices em 80 ms).
- **Backup completo e restauração** validados; lembrete de backup; armazenamento persistente; migração de dados antigos.
- **Ajuda e sobre** (guia rápido, privacidade, serviços de terceiros), tela de erro global, aviso de nova versão e de falta de internet.
- **Correção importante:** o app web agora declara o manifest e registra o service worker (antes não estavam no `index.html`), habilitando instalação e uso sem internet.
- Acessibilidade 100 (axe: 0 violações): abas em `tablist`, `aria-checked`, contraste AA, zoom liberado.
- Desempenho: peso de 5,2 MB para 961 KB; fontes de 335 KB para 16 KB; splash imediato; SEO 100.
- Formatação de números/hectares unificada (telas, PDF e exportações).
- Talhões importados mantêm a ordem do arquivo; listas longas com "Mostrar mais".
- Suíte de ponta a ponta (`e2e/`) e auditoria de acessibilidade.

## 0.7
PDF do plano, toque na bandeirinha, painéis recolhíveis, mapa em tela cheia e rolagem suave.

## 0.6
Campo de sementes (divisão em partes, variedades, guia das bandeirinhas), KMZ.

## 0.5
Veículo e velocímetro, limite da via, histórico de viagens.

## 0.4
Rotas por qualquer estrada, busca e navegação por voz.

## 0.3
Novo ícone, onboarding, transições, folha arrastável.

## 0.2
Mapa de satélite, GPS, medição, talhões, importar e exportar.
