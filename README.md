# Chuva Pro — Fazenda Lagoa Formosa (MG)

PWA de previsão de chuva por talhão (soja), mobile-first e offline-first. Só a Lagoa Formosa (18 talhões, ~2.215 ha).

**App:** https://chuva-pro-fazenda-itaguaia.vercel.app (link aberto, sem login)

## Como funciona
- **Frontend:** Vite + Preact + TypeScript, Leaflet (mapa), service worker (shell em cache; API stale-while-revalidate; selo "offline" / "atualizado há X").
- **Backend:** funções serverless em `api/` (Vercel). `/api/previsao` busca o Open-Meteo **uma vez por grupo de talhões (~5 km)** e a CDN guarda 30 min para todos.
- **Banco:** Supabase (Postgres, RLS ligado). Tabelas: `fazendas`, `talhoes`, `previsoes`, `chuva_medida`, `erro_modelo`, `limites_operacao`, `push_subs`, `alertas_enviados` (ver `supabase/migrations`).
- **Cálculo (`shared/calc.ts`)**: média ponderada de 6 modelos (ECMWF AIFS (IA), ECMWF IFS, GFS, ICON, GEM, UKMO). O peso por horizonte (0, 1, 3 e 7 dias) vem do erro (habilidade 1/(MAE+0,3)², com encolhimento para pesos iguais conforme poucos dias): **desde o 1º dia pelo hindcast de 90 dias** (previsões antigas × ERA5/NASA POWER, `api/_hind.ts`) e, com ≥ 20 dias de pluviômetro, **pelo seu pluviômetro**. A **chance de chuva e a faixa P10–P90** vêm do ensemble multi-sistema (IFS 51, AIFS 51, GEFS 31, ICON 40, GEM 21, UKMO 18 membros; cada sistema pesa igual). O fator de correção de viés (Σmedido/Σprevisto, 0,5–2) só existe com ≥ 20 dias de pluviômetro; mostra sempre bruto e corrigido.
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
