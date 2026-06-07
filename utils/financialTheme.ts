export type FinancialThemeMode = 'positive' | 'negative' | 'neutral';

export interface FinancialTheme {
  mode: FinancialThemeMode;
  label: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  border: string;
  textOnAccent: string;
  danger: string;
  success: string;
}

export function getFinancialTheme(balance: number): FinancialTheme {
  if (balance > 0) {
    return {
      mode: 'positive',
      label: 'Saldo positivo',
      accent: '#059669',
      accentDark: '#047857',
      accentSoft: '#D1FAE5',
      border: '#A7F3D0',
      textOnAccent: '#FFFFFF',
      danger: '#DC2626',
      success: '#059669',
    };
  }

  if (balance < 0) {
    return {
      mode: 'negative',
      label: 'Saldo negativo',
      accent: '#DC2626',
      accentDark: '#991B1B',
      accentSoft: '#FEE2E2',
      border: '#FCA5A5',
      textOnAccent: '#FFFFFF',
      danger: '#DC2626',
      success: '#059669',
    };
  }

  return {
    mode: 'neutral',
    label: 'Saldo equilibrado',
    accent: '#4B5563',
    accentDark: '#111827',
    accentSoft: '#F3F4F6',
    border: '#E5E7EB',
    textOnAccent: '#FFFFFF',
    danger: '#DC2626',
    success: '#059669',
  };
}
