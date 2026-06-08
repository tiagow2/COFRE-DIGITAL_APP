/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useMemo } from 'react';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  const finance = useFinance();
  const { user } = useAuth();

  let dynamicColor = undefined;
  if (colorName === 'tint' || colorName === 'tabIconSelected') {
    const txs = finance?.transactions || [];
    const balance = useMemo(() => {
      if (!user?.uid) return 0;
      const userTxs = txs.filter((t: any) => t.userId === user.uid || t.user_id === user.uid);
      const inc = userTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      const exp = userTxs.filter((t: any) => t.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance')).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      return inc - exp;
    }, [txs, user?.uid]);

    if (balance >= 0) {
      dynamicColor = theme === 'light' ? '#1D9E75' : '#2ecc71';
    } else {
      dynamicColor = theme === 'light' ? '#D85A30' : '#e74c3c';
    }
  }

  if (colorFromProps) {
    return colorFromProps;
  } else if (dynamicColor) {
    return dynamicColor;
  } else {
    return Colors[theme][colorName];
  }
}
