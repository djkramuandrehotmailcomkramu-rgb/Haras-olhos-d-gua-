# Changelog

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
