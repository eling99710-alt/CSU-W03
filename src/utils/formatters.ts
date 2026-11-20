/**
 * 數值與單位格式化輔助函式
 */

export function formatNum(
  val: number | null | undefined,
  decimals: number = 3,
  useScientificUnder: number = 1e-4
): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  if (val === 0) return '0';

  const absVal = Math.abs(val);
  if (absVal < useScientificUnder || absVal >= 1e7) {
    return val.toExponential(decimals);
  }

  return val.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(
  val: number | null | undefined,
  decimals: number = 2
): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
}
