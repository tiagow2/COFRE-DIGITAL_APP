import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { getCardLimitInfo } from '@/utils/cardLimits';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { loanService, Loan } from '@/services/loanService';

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeDate = (value: unknown) => {
  const date = new Date(typeof value === 'string' ? value : new Date().toISOString());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const CAT_COLORS: Record<string, string> = {
  Alimentação: '#F59E0B',
  Transporte: '#10B981',
  Lazer: '#EC4899',
  Saúde: '#14B8A6',
  Moradia: '#3B82F6',
  Educação: '#8B5CF6',
  Outros: '#6B7280',
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const { creditCards, transactions, getBalance, getMonthlyIncome, getMonthlyExpenses } = useFinance();
  const router = useRouter();
  const theme = useFinancialTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'annual'>('overview');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [localLoans, setLocalLoans] = useState<Loan[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loanService.listLoans(user.uid).then(setLocalLoans);
      }
    }, [user?.uid])
  );

  const balance = getBalance();

  const years = useMemo(() => {
    const found = new Set<number>([new Date().getFullYear()]);
    transactions.forEach((tx) => found.add(safeDate(tx.date).getFullYear()));
    return Array.from(found).sort((a, b) => b - a);
  }, [transactions]);

  const flow = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthTransactions = transactions.filter((tx) => {
        const txDate = safeDate(tx.date);
        return txDate.getMonth() === date.getMonth() && txDate.getFullYear() === date.getFullYear();
      });
      const income = monthTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + asNumber(tx.amount), 0);
      const expense = monthTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + asNumber(tx.amount), 0);

      return {
        label: date.toLocaleDateString('pt-BR', { month: 'short' }),
        value: income - expense,
      };
    });
  }, [transactions]);

  const projection = useMemo(() => {
    const monthlyIncome = getMonthlyIncome();
    const monthlyExpense = getMonthlyExpenses();
    let running = balance;
    const now = new Date();

    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
      running += monthlyIncome - monthlyExpense;

      return {
        label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        balance: running,
      };
    });
  }, [balance, getMonthlyExpenses, getMonthlyIncome]);

  const annual = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, month) => ({
      month,
      label: new Date(selectedYear, month, 1).toLocaleDateString('pt-BR', { month: 'short' }),
      income: 0,
      expense: 0,
      transactions: [] as typeof transactions,
    }));
    const categories = new Map<string, { category: string; total: number; count: number; transactions: typeof transactions; byMonth: number[] }>();
    const cards = new Map<string, { name: string; total: number; count: number }>();

    const yearTransactions = transactions.filter((tx) => safeDate(tx.date).getFullYear() === selectedYear);

    yearTransactions.forEach((tx) => {
      const date = safeDate(tx.date);
      const month = months[date.getMonth()];
      month.transactions.push(tx);

      if (tx.type === 'income') {
        month.income += asNumber(tx.amount);
        return;
      }

      const amount = asNumber(tx.amount);
      month.expense += amount;
      const category = tx.category || 'Outros';
      const current = categories.get(category) ?? {
        category,
        total: 0,
        count: 0,
        transactions: [] as typeof transactions,
        byMonth: Array(12).fill(0) as number[],
      };
      current.total += amount;
      current.count += 1;
      current.transactions.push(tx);
      current.byMonth[date.getMonth()] += amount;
      categories.set(category, current);

      if (tx.creditCardId || tx.creditCardName) {
        const key = tx.creditCardId || tx.creditCardName || 'card';
        const card = cards.get(key) ?? { name: tx.creditCardName || 'Cartão', total: 0, count: 0 };
        card.total += amount;
        card.count += 1;
        cards.set(key, card);
      }
    });

    const totalIncome = months.reduce((sum, month) => sum + month.income, 0);
    const totalExpense = months.reduce((sum, month) => sum + month.expense, 0);
    const categoriesList = Array.from(categories.values()).sort((a, b) => b.total - a.total);
    const biggestMonth = [...months].sort((a, b) => b.expense - a.expense)[0];
    const biggestCategory = categoriesList[0];
    const mostUsedCard = Array.from(cards.values()).sort((a, b) => b.total - a.total)[0];

    return {
      months,
      yearTransactions,
      totalIncome,
      totalExpense,
      finalBalance: totalIncome - totalExpense,
      categories: categoriesList,
      biggestMonth,
      biggestCategory,
      mostUsedCard,
    };
  }, [selectedYear, transactions]);

  const flowMax = Math.max(...flow.map((item) => Math.abs(item.value)), 1);
  const annualMax = Math.max(...annual.months.map((month) => Math.max(month.income, month.expense)), 1);
  const selectedCategoryData = annual.categories.find((item) => item.category === selectedCategory);
  const selectedMonthData = selectedMonth === null ? null : annual.months[selectedMonth];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <LinearGradient colors={[theme.accent, theme.accentDark]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.heroLabel}>{balance > 0 ? 'Saldo positivo' : balance < 0 ? 'Saldo negativo' : 'Saldo zerado'}</Text>
          <Text style={s.heroBalance} adjustsFontSizeToFit numberOfLines={1}>{fmt(balance)}</Text>
          <Text style={s.heroSub}>Tema ajustado conforme seu saldo atual</Text>
          <View style={s.heroRow}>
            <View style={s.heroItem}>
              <Ionicons name="arrow-down-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={s.heroItemTxt} numberOfLines={1} adjustsFontSizeToFit>{fmt(getMonthlyIncome())}</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroItem}>
              <Ionicons name="arrow-up-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={s.heroItemTxt} numberOfLines={1} adjustsFontSizeToFit>{fmt(getMonthlyExpenses())}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={s.tabBar}>
          {(['overview', 'cashflow', 'annual'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab);
              }}
            >
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                {tab === 'overview' ? 'Visão' : tab === 'cashflow' ? 'Fluxo' : 'Anual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && (
          <>
            {creditCards.length > 0 && (
              <>
                <Text style={s.secTitle}>Cartões de crédito</Text>
                {creditCards.map((card) => {
                  const info = getCardLimitInfo(card);
                  return (
                    <TouchableOpacity key={card.id} style={s.cardRow} onPress={() => router.push('/(app)/(tabs)/credit-cards' as never)}>
                      <View style={[s.cardDot, { backgroundColor: card.color || '#1565C0' }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.cardHeaderLine}>
                          <Text style={s.cardName} numberOfLines={1}>{card.name} •••• {card.lastDigits}</Text>
                          <Text style={[s.cardPct, { color: info.color }]} numberOfLines={1}>{info.percentage}%</Text>
                        </View>
                        <View style={s.progressBg}>
                          <View style={[s.progressFill, { width: `${info.percentage}%`, backgroundColor: info.color }]} />
                        </View>
                        <Text style={s.cardSub} numberOfLines={1}>{fmt(info.used)} usado • {fmt(info.available)} livre</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {localLoans.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 }}>
                  <Text style={[s.secTitle, { paddingRight: 0 }]}>Empréstimos e dívidas</Text>
                  <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/loans' as never)}>
                    <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: '600' }}>Gerenciar</Text>
                  </TouchableOpacity>
                </View>
                {localLoans.slice(0, 3).map((loan) => {
                  const installments = loan.installments;
                  const paid = loan.paidInstallments;
                  const pct = installments > 0 ? Math.min(Math.round((paid / installments) * 100), 100) : 0;
                  const monthly = loan.installmentValue;

                  return (
                    <View key={loan.id} style={s.loanRow}>
                      <Ionicons name="cash-outline" size={18} color="#6B7280" />
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        <Text style={s.cardName} numberOfLines={1}>{loan.name}</Text>
                        <View style={[s.progressBg, { marginTop: 6 }]}>
                          <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: '#10B981' }]} />
                        </View>
                        <Text style={s.cardSub} numberOfLines={1}>{paid}/{installments} parcelas pagas</Text>
                      </View>
                      <Text style={s.loanValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(monthly)}/mês</Text>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={s.secTitle}>Ferramentas</Text>
            <View style={s.toolsGrid}>
              {[
                { label: 'Ver extrato', icon: 'receipt-outline', color: '#7C3AED', action: () => router.push('/(app)/(tabs)/extrato' as never) },
                { label: 'Cartões', icon: 'card-outline', color: '#1565C0', action: () => router.push('/(app)/(tabs)/credit-cards' as never) },
                { label: 'Simulador', icon: 'calculator-outline', color: '#059669', action: () => router.push('/(app)/(tabs)/simulator' as never) },
                { label: 'Comparar região', icon: 'people-outline', color: '#D97706', action: () => router.push('/(app)/(tabs)/compare' as never) },
                { label: 'Lembretes', icon: 'location-outline', color: '#0F766E', action: () => router.push('/(app)/(tabs)/geo-reminders' as never) },
                { label: 'Desafios', icon: 'trophy-outline', color: '#BE123C', action: () => router.push('/(app)/(tabs)/challenges' as never) },
                { label: 'Dívidas', icon: 'cash-outline', color: '#8B5CF6', action: () => router.push('/(app)/(tabs)/loans' as never) },
              ].map((tool) => (
                <TouchableOpacity key={tool.label} style={s.toolBtn} onPress={tool.action}>
                  <View style={[s.toolIcon, { backgroundColor: `${tool.color}20` }]}>
                    <Ionicons name={tool.icon as any} size={22} color={tool.color} />
                  </View>
                  <Text style={s.toolLabel} numberOfLines={2}>{tool.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {activeTab === 'cashflow' && (
          <>
            <Text style={s.secTitle}>Fluxo dos últimos 6 meses</Text>
            <View style={s.chartCard}>
              <View style={s.chartBars}>
                {flow.map((item) => {
                  const height = Math.max(Math.abs(item.value) / flowMax, 0.04) * 120;
                  const color = item.value >= 0 ? '#10B981' : '#EF4444';
                  return (
                    <View key={item.label} style={s.barCol}>
                      <View style={[s.bar, { height, backgroundColor: color, marginTop: 120 - height }]} />
                      <Text style={s.barLabel}>{item.label}</Text>
                      <Text style={[s.barVal, { color }]}>{item.value >= 0 ? '+' : ''}{(item.value / 1000).toFixed(1)}k</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={s.secTitle}>Projeção dos próximos 12 meses</Text>
            <View style={s.projectionCard}>
              <Text style={s.note}>Baseada nas receitas e despesas registradas este mês.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {projection.map((item) => (
                  <View key={item.label} style={[s.projectionItem, { backgroundColor: item.balance >= 0 ? '#F0FDF4' : '#FEF2F2', borderColor: item.balance >= 0 ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={s.projectionMonth}>{item.label}</Text>
                    <Text style={[s.projectionValue, { color: item.balance >= 0 ? '#059669' : '#EF4444' }]}>
                      {item.balance >= 0 ? '+' : ''}{(item.balance / 1000).toFixed(1)}k
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {activeTab === 'annual' && (
          <>
            <View style={s.annualHeader}>
              <Text style={s.secTitleInline}>Relatório anual</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.yearList}>
                {years.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[s.yearChip, selectedYear === year && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedYear(year);
                      setSelectedCategory(null);
                      setSelectedMonth(null);
                    }}
                  >
                    <Text style={[s.yearChipText, selectedYear === year && s.yearChipTextActive]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {annual.yearTransactions.length === 0 ? (
              <View style={s.emptyChart}>
                <Ionicons name="bar-chart-outline" size={40} color="#D1D5DB" />
                <Text style={s.emptyText}>Nenhum dado financeiro encontrado para {selectedYear}.</Text>
              </View>
            ) : (
              <>
                <View style={s.summaryGrid}>
                  <Metric title="Receitas" value={fmt(annual.totalIncome)} color="#059669" />
                  <Metric title="Despesas" value={fmt(annual.totalExpense)} color="#EF4444" />
                  <Metric title="Saldo final" value={fmt(annual.finalBalance)} color={annual.finalBalance >= 0 ? '#059669' : '#EF4444'} />
                  <Metric title="Maior mês" value={annual.biggestMonth ? `${annual.biggestMonth.label} ${fmt(annual.biggestMonth.expense)}` : '--'} color="#D97706" />
                  <Metric title="Categoria líder" value={annual.biggestCategory ? annual.biggestCategory.category : '--'} color="#7C3AED" />
                  <Metric title="Cartão mais usado" value={annual.mostUsedCard ? annual.mostUsedCard.name : 'Sem dados'} color="#1565C0" />
                </View>

                <Text style={s.secTitle}>Receita x despesa por mês</Text>
                <View style={s.chartCard}>
                  <View style={s.annualBars}>
                    {annual.months.map((month) => {
                      const active = selectedMonth === month.month;
                      const incomeHeight = Math.max(month.income / annualMax, 0.04) * 112;
                      const expenseHeight = Math.max(month.expense / annualMax, 0.04) * 112;

                      return (
                        <TouchableOpacity
                          key={month.month}
                          style={[s.monthCol, active && s.monthColActive]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedMonth(active ? null : month.month);
                          }}
                        >
                          <View style={s.monthBars}>
                            <View style={[s.smallBar, { height: incomeHeight, backgroundColor: '#10B981' }]} />
                            <View style={[s.smallBar, { height: expenseHeight, backgroundColor: '#EF4444' }]} />
                          </View>
                          <Text style={s.barLabel}>{month.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {selectedMonthData && (
                  <View style={s.detailCard}>
                    <Text style={s.detailTitle}>{selectedMonthData.label} de {selectedYear}</Text>
                    <Text style={s.detailText}>Receitas: {fmt(selectedMonthData.income)} • Despesas: {fmt(selectedMonthData.expense)}</Text>
                    {selectedMonthData.transactions.slice(0, 5).map((tx) => (
                      <Text key={tx.id} style={s.detailLine} numberOfLines={1}>
                        {tx.type === 'income' ? '+' : '-'} {tx.description} • {fmt(asNumber(tx.amount))}
                      </Text>
                    ))}
                  </View>
                )}

                <Text style={s.secTitle}>Gastos por categoria</Text>
                <View style={s.annualCard}>
                  {annual.categories.map((item, index) => {
                    const total = Math.max(annual.totalExpense, 1);
                    const pct = Math.round((item.total / total) * 100);
                    const active = selectedCategory === item.category;
                    const color = CAT_COLORS[item.category] ?? '#6B7280';

                    return (
                      <TouchableOpacity
                        key={item.category}
                        style={[s.annualRow, active && s.annualRowActive, index === annual.categories.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedCategory(active ? null : item.category);
                        }}
                      >
                        <View style={s.categoryHeader}>
                          <View style={[s.catDot, { backgroundColor: color }]} />
                          <Text style={s.annualCat} numberOfLines={1}>{item.category}</Text>
                          <Text style={s.annualPct}>{pct}%</Text>
                          <Text style={s.annualAmt} numberOfLines={1} adjustsFontSizeToFit>{fmt(item.total)}</Text>
                        </View>
                        <View style={s.progressBg}>
                          <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedCategoryData && (
                  <View style={s.detailCard}>
                    <Text style={s.detailTitle}>{selectedCategoryData.category}</Text>
                    <Text style={s.detailText}>
                      Total: {fmt(selectedCategoryData.total)} • {selectedCategoryData.count} transações • média mensal {fmt(selectedCategoryData.total / 12)}
                    </Text>
                    {selectedCategoryData.transactions
                      .slice()
                      .sort((a, b) => asNumber(b.amount) - asNumber(a.amount))
                      .slice(0, 4)
                      .map((tx) => (
                        <Text key={tx.id} style={s.detailLine} numberOfLines={1}>
                          {safeDate(tx.date).toLocaleDateString('pt-BR')} • {tx.description} • {fmt(asNumber(tx.amount))}
                        </Text>
                      ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricTitle} numberOfLines={1}>{title}</Text>
      <Text style={[s.metricValue, { color }]} numberOfLines={2} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 120 },
  hero: { marginHorizontal: 20, marginTop: 10, borderRadius: 32, padding: 28, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  heroBalance: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  heroItemTxt: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 0 },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F1F5F9', borderRadius: 20, padding: 6, marginBottom: 20 },
  tab: { flex: 1, minWidth: 0, paddingVertical: 12, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabTxt: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTxtActive: { color: '#111827', fontWeight: '800' },
  secTitle: { fontSize: 15, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  secTitleInline: { fontSize: 15, fontWeight: '800', color: '#111827' },
  cardRow: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardDot: { width: 12, height: 12, borderRadius: 6 },
  cardHeaderLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  cardPct: { fontSize: 12, fontWeight: '800', flexShrink: 0 },
  cardSub: { fontSize: 11, color: '#9CA3AF', marginTop: 4, minWidth: 0 },
  loanRow: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  loanValue: { fontSize: 13, fontWeight: '800', color: '#EF4444', flexShrink: 0, maxWidth: 118 },
  progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  toolBtn: { flexGrow: 1, flexBasis: '47%', minWidth: 130, backgroundColor: '#F8FAFC', borderRadius: 24, padding: 18, alignItems: 'flex-start' },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  toolLabel: { fontSize: 13, fontWeight: '700', color: '#111827', minWidth: 0 },
  chartCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 170 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '60%', borderRadius: 4 },
  barLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  barVal: { fontSize: 10, fontWeight: '800' },
  projectionCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  note: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  projectionItem: { width: 72, marginRight: 10, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1 },
  projectionMonth: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginBottom: 4 },
  projectionValue: { fontSize: 13, fontWeight: '800' },
  annualHeader: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  yearList: { gap: 8, paddingRight: 20 },
  yearChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  yearChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  yearChipText: { fontSize: 13, color: '#6B7280', fontWeight: '800' },
  yearChipTextActive: { color: '#fff' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  metricCard: { flexGrow: 1, flexBasis: '47%', minWidth: 134, backgroundColor: '#F8FAFC', borderRadius: 24, padding: 18 },
  metricTitle: { fontSize: 11, color: '#9CA3AF', fontWeight: '800', marginBottom: 6 },
  metricValue: { fontSize: 14, fontWeight: '800', minWidth: 0 },
  annualBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 162 },
  monthCol: { flex: 1, minWidth: 0, alignItems: 'center', borderRadius: 12, paddingVertical: 4 },
  monthColActive: { backgroundColor: '#F3F4F6' },
  monthBars: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 6 },
  smallBar: { width: 5, borderRadius: 3 },
  annualCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  annualRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  annualRowActive: { backgroundColor: '#F9FAFB' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  annualCat: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  annualPct: { fontSize: 13, fontWeight: '800', color: '#6B7280', marginRight: 8, flexShrink: 0 },
  annualAmt: { fontSize: 13, fontWeight: '800', color: '#111827', minWidth: 72, maxWidth: 118, textAlign: 'right' },
  detailCard: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  detailTitle: { fontSize: 15, color: '#111827', fontWeight: '800', marginBottom: 6 },
  detailText: { fontSize: 12, color: '#4B5563', lineHeight: 18, marginBottom: 8 },
  detailLine: { fontSize: 12, color: '#6B7280', paddingVertical: 3 },
  emptyChart: { alignItems: 'center', paddingVertical: 42, marginHorizontal: 20, marginTop: 14, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { color: '#9CA3AF', marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
