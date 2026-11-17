# Changelog

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
