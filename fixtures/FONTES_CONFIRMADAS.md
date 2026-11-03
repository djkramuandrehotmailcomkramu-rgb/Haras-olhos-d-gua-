# Fontes confirmadas (chamadas reais, 03/11/2026)

Coleta feita via sandbox Vercel (autorizado pelo usuário), porque a rede deste ambiente bloqueia os hosts.
Ponto de teste: centroide do KML Lagoa Formosa (-16.272, -46.130), America/Sao_Paulo.

| Fonte | Status | Observações reais |
|---|---|---|
| api.open-meteo.com/v1/forecast | 200 | `models=best_match,ecmwf_ifs025,gfs_seamless,icon_seamless`. Chaves com sufixo `_<modelo>`. `timeformat=unixtime`. `past_days=3&forecast_days=16` retorna 456 h / 19 dias. Grade encaixada em -16.274,-46.154 (elev. 892 m) |
| ECMWF IFS 0.25 | parcial | 14 horas nulas em 456; diário nulo no último dia (18/11) |
| GFS seamless | completo | 456/456 h |
| ICON seamless | só ~10 dias | diário nulo após 09/11 (262/456 h). Não serve para 15 dias |
| best_match | completo | 16 dias; no último dia copia o GFS (27.7 mm) |
| previous-runs-api | 200 | `precipitation_previous_day1/3` por modelo. Grade 0.25 (-16.25,-46.25). Base do cálculo de erro por horizonte |
| archive-api (ERA5/reanálise) | 200 | Valores diários para out/2026 (total 76.0 mm). É reanálise, NÃO é pluviômetro |
| ensemble-api | 200 | `ecmwf_ifs025` = 51 membros; `gfs025` = 30 membros (chaves `..._ncep_gefs025`; o nome `gfs_seamless` não existe aqui). 168 h |
| RainViewer weather-maps.json | 200 | 13 quadros de radar passado, 0 de nowcast; tile PNG 200. Host tilecache.rainviewer.com |

## Achados que mudam o projeto
1. Modelos discordam muito: 09/11 ECMWF 26.1 mm vs best_match 9.8 mm; 10/11 ECMWF 30 mm vs best_match 9 mm. Por isso o ensemble ponderado e a calibração fazem sentido.
2. Cada API encaixa o ponto em uma grade diferente (forecast ≈ 0.1°, previous-runs/ensemble 0.25°). A regra de "mesma célula" precisa usar a célula de cada API.
3. Arquivo ERA5 subestima/atrasa pancadas convectivas; não tratar como chuva medida.
4. RainViewer: radar do passado confirmado. Cobertura real em MG/MT ainda precisa de verificação visual (tile de teste foi só HTTP 200).
5. Coordenadas do KML ficam em ~-16.27/-46.13 (não -18.77 como usado na primeira coleta, descartada).
6. KML Lagoa Formosa tem 19 polígonos mas 18 talhões únicos ("Área do Curral" duplicado, geometria idêntica).
