export interface ParsedBoleto {
  original: string;
  digits: string;
  barcode: string;
  amount: number;
  amountText: string;
  dueDate: string | null;
  bankCode: string | null;
  bankName: string;
  type: 'bank' | 'utility';
  warnings: string[];
}

const BANKS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '104': 'Caixa',
  '237': 'Bradesco',
  '260': 'Nu Pagamentos',
  '341': 'Itau',
  '336': 'C6 Bank',
  '422': 'Safra',
  '745': 'Citibank',
};

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function mod10(value: string) {
  let multiplier = 2;
  let sum = 0;

  for (let i = value.length - 1; i >= 0; i -= 1) {
    const product = Number(value[i]) * multiplier;
    sum += product > 9 ? Math.floor(product / 10) + (product % 10) : product;
    multiplier = multiplier === 2 ? 1 : 2;
  }

  return (10 - (sum % 10)) % 10;
}

function bankBarcodeDigit(value: string) {
  let multiplier = 2;
  let sum = 0;

  for (let i = value.length - 1; i >= 0; i -= 1) {
    sum += Number(value[i]) * multiplier;
    multiplier = multiplier === 9 ? 2 : multiplier + 1;
  }

  const digit = 11 - (sum % 11);
  return digit === 0 || digit === 10 || digit === 11 ? 1 : digit;
}

function validateBankLine(digits: string, warnings: string[]) {
  const fields = [
    { body: digits.slice(0, 9), digit: digits[9] },
    { body: digits.slice(10, 20), digit: digits[20] },
    { body: digits.slice(21, 31), digit: digits[31] },
  ];

  fields.forEach((field, index) => {
    if (mod10(field.body) !== Number(field.digit)) {
      warnings.push(`Campo ${index + 1} da linha digitavel nao passou no digito verificador.`);
    }
  });
}

function bankLineToBarcode(digits: string) {
  return [
    digits.slice(0, 4),
    digits[32],
    digits.slice(33, 47),
    digits.slice(4, 9),
    digits.slice(10, 20),
    digits.slice(21, 31),
  ].join('');
}

function utilityLineToBarcode(digits: string, warnings: string[]) {
  const parts = [
    digits.slice(0, 11),
    digits.slice(12, 23),
    digits.slice(24, 35),
    digits.slice(36, 47),
  ];
  const verifierDigits = [digits[11], digits[23], digits[35], digits[47]];

  parts.forEach((part, index) => {
    if (mod10(part) !== Number(verifierDigits[index])) {
      warnings.push(`Bloco ${index + 1} da linha digitavel nao passou no digito verificador.`);
    }
  });

  return parts.join('');
}

function dueDateFromFactor(factor: number): string | null {
  if (!Number.isFinite(factor) || factor <= 0) return null;

  const oldBase = new Date('1997-10-07T00:00:00-03:00');
  const oldDate = new Date(oldBase);
  oldDate.setDate(oldDate.getDate() + factor);

  const resetDate = new Date('2025-02-22T00:00:00-03:00');
  if (oldDate < resetDate && factor >= 1000) {
    const newDate = new Date(resetDate);
    newDate.setDate(newDate.getDate() + (factor - 1000));
    return newDate.toISOString();
  }

  return oldDate.toISOString();
}

function parseBankBarcode(original: string, barcode: string, warnings: string[]): ParsedBoleto {
  const withoutDigit = `${barcode.slice(0, 4)}${barcode.slice(5)}`;
  if (bankBarcodeDigit(withoutDigit) !== Number(barcode[4])) {
    warnings.push('Codigo de barras nao passou no digito verificador principal.');
  }

  const bankCode = barcode.slice(0, 3);
  const dueFactor = Number(barcode.slice(5, 9));
  const amount = Number(barcode.slice(9, 19)) / 100;

  return {
    original,
    digits: barcode,
    barcode,
    amount: Number.isFinite(amount) ? amount : 0,
    amountText: Number.isFinite(amount) && amount > 0 ? fmt(amount) : 'Valor nao informado',
    dueDate: dueDateFromFactor(dueFactor),
    bankCode,
    bankName: BANKS[bankCode] ?? `Banco ${bankCode}`,
    type: 'bank',
    warnings,
  };
}

function parseUtilityBarcode(original: string, barcode: string, warnings: string[]): ParsedBoleto {
  const amountIndicator = barcode[2];
  const amount =
    amountIndicator === '6' || amountIndicator === '7'
      ? Number(barcode.slice(4, 15)) / 100
      : 0;

  return {
    original,
    digits: barcode,
    barcode,
    amount: Number.isFinite(amount) ? amount : 0,
    amountText: Number.isFinite(amount) && amount > 0 ? fmt(amount) : 'Valor nao informado',
    dueDate: null,
    bankCode: null,
    bankName: 'Conta de consumo/convenio',
    type: 'utility',
    warnings,
  };
}

export function parseBoletoCode(value: string): ParsedBoleto | null {
  const digits = onlyDigits(value);
  const warnings: string[] = [];

  if (!digits) return null;

  if (digits.length === 47) {
    validateBankLine(digits, warnings);
    const barcode = bankLineToBarcode(digits);
    return parseBankBarcode(value, barcode, warnings);
  }

  if (digits.length === 48 && digits[0] === '8') {
    const barcode = utilityLineToBarcode(digits, warnings);
    return parseUtilityBarcode(value, barcode, warnings);
  }

  if (digits.length === 44) {
    if (digits[0] === '8') return parseUtilityBarcode(value, digits, warnings);
    return parseBankBarcode(value, digits, warnings);
  }

  return null;
}

export function formatBoletoDueDate(value: string | null) {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informado';
  return date.toLocaleDateString('pt-BR');
}
