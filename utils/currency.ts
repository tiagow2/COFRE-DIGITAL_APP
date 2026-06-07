export function parseCurrencyInput(value: string): number {
  const raw = value
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '');

  if (!raw) return NaN;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  let normalized = raw;

  if (hasComma && hasDot) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = raw.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '');
  }

  const numeric = normalized.replace(/[^\d.-]/g, '');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : NaN;
}
