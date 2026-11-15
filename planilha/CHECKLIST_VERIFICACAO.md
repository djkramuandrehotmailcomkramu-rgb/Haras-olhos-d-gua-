# Checklist de verificação — Planilha Colheita Lagoa Formosa 2026/2027

Método: gerei massas de teste (1.200, 1.500 e 3.000 viagens, com dados aleatórios e casos extremos), recalculei a planilha no LibreOffice e comparei célula a célula com o valor calculado de forma independente em Python. Resultado final: **9.393 conferências, 0 divergências; planilha vazia: 0 erros.** (Teste de 3.000 viagens: recalcula em ~4 s.)

| # | Item verificado | Resultado |
|---|---|---|
| 1 | Peso líquido = bruto − tara (todas as linhas) | OK |
| 2 | Sacas = líquido ÷ 60 | OK |
| 3 | Acumulado linha a linha | OK |
| 4 | Data digitada em 8 dígitos, 6 dígitos ou data normal vira a data correta; data inexistente é sinalizada | OK |
| 4b | Limites do Excel: validações ≤ 255 caracteres, textos em fórmula ≤ 255, parênteses balanceados em todas as fórmulas | OK (corrigido) |
| 5 | Motorista automático pela placa (com/sem traço, ponto, espaço, maiúscula/minúscula) | OK |
| 6 | Coluna CONFERIR: tara vazia, bruto < tara, placa vazia, viagem repetida, talhão vazio, placa não cadastrada, talhão fora do RESUMO, tara diferente da padrão, peso fora de 5–55 t, umidade > 18 e < 8 | OK (ordem de prioridade conferida) |
| 7 | KPIs do topo da ENTRADA (viagens, t, sacas, média geral) | OK |
| 8 | RESUMO por talhão: kg, sacas, média sc/ha (só com hectares), viagens, dias trabalhados, umidade média ponderada pelo peso | OK |
| 9 | TOTAL e MÉDIA GERAL (sacas dos talhões com hectares ÷ hectares totais) | OK |
| 10 | Média por tipo de soja e por destino | OK |
| 11 | Avisos do RESUMO (sacas sem hectares, talhão fora da lista, talhão repetido, talhão sem qualidade) | OK |
| 12 | POR DIA: data, viagens, sacas, toneladas, acumulado, sacas por viagem | OK |
| 13 | CAMINHÕES: sacas por placa por dia, dias trabalhados, acumulado, total e aviso de placa não cadastrada/repetida | OK |
| 14 | Linhas vazias não geram valores nem erros | OK |
| 15 | Sem funções incompatíveis (nada exige Excel 365; funciona do Excel 2007 em diante) | OK |
| 16 | Mensagens com números não dependem do idioma do Excel | OK (corrigido) |
| 17 | Planilha recalcula ao abrir (`fullCalcOnLoad`) | OK |
| 18 | Proteção: só células de digitação liberadas; fórmulas travadas (sem senha) | OK |

## Correções feitas nesta revisão
- **Erro ao abrir no Excel ("Registros removidos: Fórmula de parte de sheet1.xml")**: a regra de validação da coluna DATA tinha 277 caracteres e o Excel aceita no máximo 255. Regra reescrita (196 caracteres). Conferi também que nenhuma fórmula, validação ou texto passa dos limites do Excel e que todos os parênteses estão balanceados.
- Data inexistente (ex.: 31/02) agora é sinalizada em CONFERIR ("Informe a data (ou data inválida)") e a linha vazia de data também.
- Mensagens com `TEXT(...,"#,##0")` (erradas no Excel em português) → `FIXED`.
- Data de 4 dígitos (`1411`) removida: usava o ano atual e mudava sozinha ao abrir a planilha em outro ano.
- `MINIFS/MAXIFS` removidos (davam #NOME? em Excel antigo); DIAS agora conta os dias realmente trabalhados.
- CONFERIR passou a avisar tara vazia, bruto menor que a tara, placa vazia e viagem repetida.
- Avisos para talhão repetido, talhão sem qualidade e placa repetida em LISTAS (somas duplicadas).
- Umidade média ponderada pelo peso.
- Nome do talhão não aceita `* ? ~` nem espaço sobrando.
- CAMINHÕES e POR DIA alinhados em 60 dias; aba COMO USAR incluída.

## Limites
3.000 viagens · 45 talhões · 100 placas · 60 dias de colheita. Excel 2007 ou mais novo.
