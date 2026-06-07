import { useFinance } from '@/context/FinanceContext';
import { getFinancialTheme } from '@/utils/financialTheme';
import { useMemo } from 'react';

export function useFinancialTheme() {
  const { getBalance } = useFinance();
  const balance = getBalance();

  return useMemo(() => getFinancialTheme(balance), [balance]);
}
