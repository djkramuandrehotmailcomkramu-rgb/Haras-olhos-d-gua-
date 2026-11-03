# Relatório honesto — Chuva Pro (Lagoa Formosa)

Data: 03/11/2026. Escopo final: **somente Fazenda Lagoa Formosa** (Itaguaia foi retirada a pedido).

## Validado com dado real
- **Open-Meteo** (forecast com 4 modelos, previous-runs, ensemble, archive) e **RainViewer** respondem 200 e formato/chaves foram conferidos (`fixtures/FONTES_CONFIRMADAS.md`).
- **App publicado** consulta a previsão real por grupo de talhões (2 grupos: 14 + 4 talhões; células de grade diferentes) e o banco Supabase real.
- **e2e em celular (Pixel 5, Chromium) contra o link publicado: tudo OK** — HOJE, SEMANA (15 dias + hora a hora), TALHÕES (18), MAPA (18 polígonos + GPS), MEDIDA (salva e apaga), CONFIABILIDADE, AJUSTES, **modo offline** (abre com o último dado) e zero erros de console. Primeira tela útil medida: 1,5–2,1 s a partir de datacenter (não é 4G de campo).
- **KML real**: 19 polígonos → 18 talhões (um duplicado detectado), ~2.215 ha.
- **Cron** executado manualmente: gravou 54 previsões reais (modelo × dia).
- 24 testes unitários + testes de contrato contra a API real.

## Melhorias de precisão (04/11)
- **Mais modelos:** GEM, JMA e UKMO somados a ECMWF, GFS e ICON; `best_match` saiu da média (repete o ECMWF e teve erro maior).
- **Pesos por horizonte desde o dia 1**, aprendidos do hindcast de 90 dias. Resultado real (ERA5, D+1): GFS MAE 0,94 mm; ECMWF 1,11; UKMO 1,15; ICON 1,59; JMA 1,62; GEM 1,71. **A D+3 o ranking inverte** (GEM 1,14; UKMO 1,28; ECMWF 1,42; GFS 2,87).
- **Chance de chuva e faixa P10–P90 reais** pelo ensemble de 81 membros, no lugar da probabilidade dos modelos (que repetia o ECMWF).
- Testado e descartado: NASA POWER IMERG (veio vazio); modelos de IA (AIFS, GraphCast) sem dado na região.
- **Grades diferem por modelo:** ECMWF, GFS e JMA dão números idênticos aos dois grupos de talhões; ICON, GEM e UKMO (mais finos) diferenciam. "Mesma célula" só aparece quando todos os modelos são idênticos.
- **Ensemble:** 82 membros até ~10 dias; depois disso só os 51 do ECMWF.
- **Cuidado:** o hindcast usa os últimos 90 dias (estiagem, poucos dias de chuva) e a referência é reanálise, não pluviômetro. O ranking pode mudar na época das águas.

## Busca dos modelos gratuitos mais precisos (04/11)
Testados com dado real no ponto da fazenda (90 dias de previsões antigas × média de ERA5 e NASA POWER; D+1 / D+3 / D+5 / D+7, erro médio em mm/dia):
| Modelo | D+1 | D+3 | D+5 | D+7 |
|---|---|---|---|---|
| **ECMWF AIFS (IA)** | **0,76** | **1,04** | **1,07** | **1,06** |
| GFS | 0,80 | — | 1,22 | 1,48 |
| UKMO | 1,09 | 1,10 | 1,32 | — |
| GEM | 1,42 | 1,06 | 1,38 | 1,29 |
| ECMWF IFS 25 km | 1,07 | 1,28 | 2,14 | 1,86 |
| ECMWF IFS 9 km | 1,23 | 1,56 | 2,06 | 1,87 |
| ICON | 1,39 | 1,48 | 1,18 | sem dado |
| JMA / Météo-France / CMA | 1,3–1,7 | pior ou pouca cobertura | | |
- O **AIFS** (a chave certa é `ecmwf_aifs025_single`; antes testei a errada) foi o melhor em todos os horizontes e detectou 8 de 8 chuvas ≥ 5 mm a D+3. Entrou no topo; JMA/Météo-France/CMA saíram; o IFS (25 e 9 km) tem viés úmido de +1,2 a +1,6 mm/dia de D+5 a D+7 (os pesos já o reduzem).
- **Ensembles gratuitos disponíveis:** IFS 51, **AIFS 51**, GEFS 31, ICON 40, GEM 21, UKMO 18 membros — 212 no total, em 0,6 s.
- **Sem dado na região:** GraphCast, KMA, BOM.
- **Fonte observada brasileira gratuita (não integrada):** MERGE do INPE/CPTEC (GPM-IMERG late ajustado por pluviômetros, 10 km, diário, até o dia anterior), em `ftp.cptec.inpe.br/modelos/tempo/MERGE/GPM/DAILY/`, sem cadastro; GRIB2 com empacotamento complexo (precisa de decodificador próprio). Seria a melhor referência para calibrar e para mostrar "choveu ontem" por talhão.
- Limite: 8 eventos ≥ 5 mm no período — amostra pequena; o ranking de detecção de chuva forte é indicativo.

## NÃO validado / limitações
1. **Precisão da previsão: desconhecida.** Ainda não há 1 dia de chuva medida. Pesos por modelo e correção de viés ficam **inativos até 20 dias** de pluviômetro (a tela mostra "calibrando"). Nada foi comparado com a realidade.
2. **Os modelos discordam muito** (ex.: 09 e 10/11 → ECMWF 26 e 30 mm; best_match 10 e 9 mm). Sem calibração, a "provável" é média simples. O `best_match` repete as probabilidades do ECMWF na região (não são independentes).
3. **ICON só cobre ~10 dias** e o ECMWF tem horas sem dado; os dias com < 4 modelos aparecem avisados.
4. **Nowcasting por radar: só visual.** O RainViewer dá imagem (≈ 2 h passadas, sem previsão). **Não há alerta de chuva iminente por radar**; não achei fonte confiável/gratuita por ponto para MG.
5. **Chuva por satélite (IMERG) não integrada** — exige cadastro NASA Earthdata (gratuito); não feito.
6. **Push com app fechado:** o código e as chaves VAPID existem, mas **não testei o envio a um aparelho real**. O cron da Vercel (plano atual) roda **1×/dia**; alerta em tempo real exigiria cron a cada 30 min (plano Pro) ou um chamador externo em `/api/cron` com `CRON_SECRET`.
7. **Segurança:** link aberto sem login, como pedido. As APIs de escrita (medidas, limites, importar KML) **ficam abertas a quem tiver o link**; o banco tem RLS ligado mas políticas de escrita abertas, e o servidor usa a chave anon. Para endurecer: login simples ou `service_role` + remover políticas abertas.
8. **Semáforos** usam limites padrão genéricos (vento 15 km/h, UR ≥ 55%…), editáveis. **Não são recomendação agronômica**; confirmar sempre na bula e no receituário.
9. **Lighthouse (PWA ≥ 90) não foi medido.** Manifesto, service worker e ícones existem.
10. **Deploy:** a integração Vercel↔GitHub não estava conectada, então o build (`build-vercel.sh`) clona o repositório público. Conectar a integração simplifica (build padrão do Vite).
11. **Pluviômetro Itaguaia:** fora do escopo (removido). O app tem backup/restauração JSON próprio da chuva medida.
12. Comparativo "previsto × medido" só terá dados depois de alguns dias de cron + lançamentos.
