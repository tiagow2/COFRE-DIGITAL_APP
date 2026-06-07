/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFinance } from '@/context/FinanceContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  const finance = useFinance();

  let dynamicColor = undefined;
  if (colorName === 'tint' || colorName === 'tabIconSelected') {
    const balance = finance && finance.getBalance ? finance.getBalance() : 0;
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
