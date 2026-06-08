import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { getFinancialTheme } from '@/utils/financialTheme';
import { useMemo } from 'react';

export function useFinancialTheme() {
  const { user } = useAuth();
  const { transactions } = useFinance();
  
  const balance = useMemo(() => {
    if (!transactions || !user?.uid) return 0;
    const userTxs = transactions.filter((t: any) => t.userId === user.uid || t.user_id === user.uid);
    const inc = userTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const exp = userTxs.filter((t: any) => t.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance')).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    return inc - exp;
  }, [transactions, user?.uid]);

  return useMemo(() => getFinancialTheme(balance), [balance]);
}
