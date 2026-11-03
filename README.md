# Chuva Pro — Fazenda Lagoa Formosa (MG)

PWA de previsão de chuva por talhão (soja), mobile-first e offline-first. Só a Lagoa Formosa (18 talhões, ~2.215 ha).

**App:** https://chuva-pro-fazenda-itaguaia.vercel.app (link aberto, sem login)

## Como funciona
- **Frontend:** Vite + Preact + TypeScript, Leaflet (mapa), service worker (shell em cache; API stale-while-revalidate; selo "offline" / "atualizado há X").
- **Backend:** funções serverless em `api/` (Vercel). `/api/previsao` busca o Open-Meteo **uma vez por grupo de talhões (~5 km)** e a CDN guarda 30 min para todos.
- **Banco:** Supabase (Postgres, RLS ligado). Tabelas: `fazendas`, `talhoes`, `previsoes`, `chuva_medida`, `erro_modelo`, `limites_operacao`, `push_subs`, `alertas_enviados` (ver `supabase/migrations`).
- **Cálculo (`shared/calc.ts`)**: média ponderada de 4 modelos (Open-Meteo best_match, ECMWF, GFS, ICON); peso ∝ 1/(erro+0,5) por horizonte **só com ≥ 20 dias de chuva medida** (antes disso, pesos iguais e "calibrando"); fator de correção de viés (Σmedido/Σprevisto, 0,5–2) também só com ≥ 20 dias; mostra bruto e corrigido.
- **Cron diário (`/api/cron`, 09:00 UTC):** grava a previsão de cada modelo, recalcula erro por modelo/horizonte (janelas 30 e 90 dias) e envia push (≥ 20 mm em 24 h ou ≥ 80% em 6 h; 1× por dia por tipo).

## Rodar / publicar
```bash
npm install
npm test            # unitários (KML real, pesos, viés, semáforos, fuso)
npm run build
URL=https://seu-app node tests/e2e.mjs   # e2e em celular (precisa de `playwright`)
URL=https://seu-app npm run seed         # importa data/lagoa-formosa.kml
```
Variáveis: veja `.env.example`. Passos: (1) criar projeto Supabase e aplicar `supabase/migrations/*.sql`; (2) `npx web-push generate-vapid-keys`; (3) configurar as variáveis na Vercel; (4) deploy. O deploy atual usa `build-vercel.sh` (clona o repo público) porque a integração Vercel↔GitHub não está conectada; conectando-a, o build padrão do Vite + `api/` funciona.

## Limitações conhecidas (leia)
Ver `RELATORIO.md`.
