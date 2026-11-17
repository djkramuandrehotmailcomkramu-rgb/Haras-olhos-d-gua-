/**
 * Lê um número digitado no padrão brasileiro: "16", "16,5", "1.234,5", " 12 ha ".
 * Devolve null se não for um número válido.
 */
export function lerNumeroBR(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return isFinite(texto) ? texto : null;
  if (texto == null) return null;
  let s = String(texto).trim().toLowerCase().replace(/\s+/g, '').replace(/ha$|hectares?$/, '');
  if (s === '' || s === '-' || s === ',' || s === '.') return null;
  const temVirgula = s.includes(',');
  const pontos = (s.match(/\./g) ?? []).length;
  if (temVirgula) {
    // "1.234,5": pontos são milhar, a vírgula é o decimal
    if (s.lastIndexOf(',') !== s.indexOf(',')) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (pontos > 1) {
    s = s.replace(/\./g, ''); // "1.234.567" = milhar
  } else if (pontos === 1 && /^\d{1,3}\.\d{3}$/.test(s)) {
    // "1.234" é ambíguo; no uso de hectares/metros tratamos como milhar apenas se tiver 3 casas exatas após o ponto e parte inteira com 1-3 dígitos
    s = s.replace('.', '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** "16,50" */
export const formatarNumeroBR = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Texto para preencher um campo de edição: 16 -> "16", 16.5 -> "16,5". */
export const paraCampoBR = (n: number, casasMax = 3) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casasMax, useGrouping: false });

/** +1,23% / -0,50% (com sinal explícito). */
export const formatarPercentual = (n: number, casas = 2) => `${n >= 0 ? '+' : ''}${formatarNumeroBR(n, casas)}%`;
