import { useFinance } from '@/context/FinanceContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DashboardScreen() {
  const { creditCards, loans, transactions, getBalance, getMonthlyIncome, getMonthlyExpenses } = useFinance();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'annual'>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const balance = getBalance();

  // RF27 - Tema dinâmico por saldo
  const themeGrad: [string, string] = balance >= 0 ? ['#059669', '#047857'] : ['#EF4444', '#DC2626'];

  // Fluxo de caixa dos últimos 6 meses (RF23)
  const { MONTHS, FLOW } = useMemo(() => {
    const months: string[] = [];
    const flow: number[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('pt-BR', { month: 'short' }));
      const inc = transactions
        .filter((t: any) => {
          const td = new Date(t.date);
          return t.type === 'income' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        })
        .reduce((s: number, t: any) => s + t.amount, 0);
      const exp = transactions
        .filter((t: any) => {
          const td = new Date(t.date);
          return t.type === 'expense' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        })
        .reduce((s: number, t: any) => s + t.amount, 0);
      flow.push(inc - exp);
    }
    return { MONTHS: months, FLOW: flow };
  }, [transactions]);
  const maxAbs = Math.max(...FLOW.map(Math.abs), 1);

  // Projeção 12 meses (RF24)
  const projection = useMemo(() => {
    const avgIncome  = getMonthlyIncome();
    const avgExpense = getMonthlyExpenses();
    const months: { label: string; balance: number }[] = [];
    let running = balance;
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      running += avgIncome - avgExpense;
      months.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        balance: running,
      });
    }
    return months;
  }, [balance, getMonthlyIncome, getMonthlyExpenses]);

  // Relatório anual por categoria (RF13)
  const annualReport = useMemo(() => {
    const year = new Date().getFullYear();
    const catMap = new Map<string, number>();
    transactions
      .filter((t: any) => t.type === 'expense' && new Date(t.date).getFullYear() === year)
      .forEach((t: any) => catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount));
    const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: Math.round((amt / total) * 100) }));
  }, [transactions]);

  const CAT_COLORS: Record<string, string> = {
    Alimentação: '#F59E0B', Transporte: '#10B981', Lazer: '#EC4899',
    Saúde: '#14B8A6', Moradia: '#3B82F6', Educação: '#8B5CF6', Outros: '#6B7280',
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header com saldo e tema dinâmico (RF27) */}
        <LinearGradient colors={themeGrad} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.heroLabel}>
            {balance >= 0 ? '💚 Saldo positivo' : '🔴 Saldo negativo'}
          </Text>
          <Text style={s.heroBalance} adjustsFontSizeToFit numberOfLines={1}>{fmt(balance)}</Text>
          <Text style={s.heroSub}>Tema mudou conforme seu saldo atual</Text>
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

        {/* Tabs */}
        <View style={s.tabBar}>
          {(['overview', 'cashflow', 'annual'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(t); }}>
              <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>
                {t === 'overview' ? 'Visão' : t === 'cashflow' ? 'Fluxo' : 'Anual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── ABA VISÃO GERAL ─── */}
        {activeTab === 'overview' && (
          <>
            {/* Cartões com alertas */}
            {creditCards.length > 0 && (
              <>
                <Text style={s.secTitle}>Cartões de crédito</Text>
                {creditCards.map((c: any) => {
                  const pct = Math.round((c.used / (c.limit || 1)) * 100);
                  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';
                  return (
                    <TouchableOpacity key={c.id} style={s.cardRow}
                      onPress={() => router.push('/(app)/(tabs)/credit-cards' as never)}>
                      <View style={[s.cardDot, { backgroundColor: c.color || '#1565C0' }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                          <Text style={s.cardName} numberOfLines={1}>•••• {c.lastDigits}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: barColor, flexShrink: 0 }} numberOfLines={1}>{pct}%</Text>
                        </View>
                        <View style={s.progBg}>
                          <View style={[s.progFill, { width: `${Math.min(pct,100)}%`, backgroundColor: barColor }]} />
                        </View>
                        <Text style={s.cardSub} numberOfLines={1}>{fmt(c.used)} de {fmt(c.limit)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Empréstimos */}
            {loans.length > 0 && (
              <>
                <Text style={s.secTitle}>Empréstimos e dívidas</Text>
                {loans.slice(0, 3).map((l: any) => {
                  const totalInstallments = l.totalInstallments ?? l.installments ?? 0;
                  const paid = Math.min(l.current ?? Math.round((l.paid / (l.monthly || 1)) || 0), totalInstallments);
                  const pct  = totalInstallments > 0 ? Math.round((paid / totalInstallments) * 100) : 0;
                  const monthly = l.installmentValue ?? l.monthly ?? 0;
                  return (
                    <View key={l.id} style={s.loanRow}>
                      <Ionicons name="cash-outline" size={18} color="#6B7280" />
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        <Text style={s.cardName} numberOfLines={1}>{l.name}</Text>
                        <View style={[s.progBg, { marginTop: 6 }]}>
                          <View style={[s.progFill, { width: `${pct}%`, backgroundColor: '#10B981' }]} />
                        </View>
                        <Text style={s.cardSub} numberOfLines={1}>{paid}/{totalInstallments} parcelas pagas</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', flexShrink: 0, maxWidth: 118 }} numberOfLines={1} adjustsFontSizeToFit>
                        {fmt(monthly)}/mês
                      </Text>
                    </View>
                  );
                })}
              </>
            )}

            {/* Atalhos */}
            <Text style={s.secTitle}>Ferramentas</Text>
            <View style={s.toolsGrid}>
              {[
                { label: 'Ver extrato',       icon: 'receipt-outline',     color: '#7C3AED', action: () => router.push('/(app)/(tabs)/extrato' as never) },
                { label: 'Simulador',         icon: 'calculator-outline',  color: '#059669', action: () => router.push('/(app)/(tabs)/simulator' as never) },
                { label: 'Desafios',           icon: 'trophy-outline',      color: '#D97706', action: () => router.push('/(app)/(tabs)/challenges' as never) },
                { label: 'Cartões',            icon: 'card-outline',         color: '#1565C0', action: () => router.push('/(app)/(tabs)/credit-cards' as never) },
              ].map(t => (
                <TouchableOpacity key={t.label} style={s.toolBtn} onPress={t.action}>
                  <View style={[s.toolIcon, { backgroundColor: t.color + '20' }]}>
                    <Ionicons name={t.icon as any} size={22} color={t.color} />
                  </View>
                  <Text style={s.toolLabel} numberOfLines={2}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ─── ABA FLUXO DE CAIXA ─── */}
        {activeTab === 'cashflow' && (
          <>
            <Text style={s.secTitle}>Fluxo dos últimos 6 meses</Text>
            <View style={s.chartCard}>
              <View style={s.chartBars}>
                {FLOW.map((v, i) => {
                  const h = Math.max(Math.abs(v) / maxAbs, 0.04) * 120;
                  const color = v >= 0 ? '#10B981' : '#EF4444';
                  return (
                    <View key={i} style={s.barCol}>
                      {v < 0 && <View style={[s.bar, { height: h, backgroundColor: color, marginTop: 120 - h }]} />}
                      {v >= 0 && <View style={[s.bar, { height: h, backgroundColor: color, marginTop: 120 - h }]} />}
                      <Text style={s.barLabel}>{MONTHS[i]}</Text>
                      <Text style={[s.barVal, { color }]}>{v >= 0 ? '+' : ''}{(v / 1000).toFixed(1)}k</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Projeção 12 meses (RF24) */}
            <Text style={s.secTitle}>Projeção dos próximos 12 meses</Text>
            <View style={s.projCard}>
              <Text style={s.projNote}>Baseado nas receitas e despesas registradas por você</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {projection.map((p, i) => (
                  <View key={i} style={[s.projItem, { borderColor: p.balance >= 0 ? '#D1FAE5' : '#FEE2E2', backgroundColor: p.balance >= 0 ? '#F0FDF4' : '#FEF2F2' }]}>
                    <Text style={s.projMonth}>{p.label}</Text>
                    <Text style={[s.projVal, { color: p.balance >= 0 ? '#059669' : '#EF4444' }]}>
                      {p.balance >= 0 ? '+' : ''}{(p.balance / 1000).toFixed(1)}k
                    </Text>
                    {p.balance < 0 && <Text style={{ fontSize: 10, color: '#EF4444' }}>⚠️</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* ─── ABA RELATÓRIO ANUAL ─── */}
        {activeTab === 'annual' && (
          <>
            <Text style={s.secTitle}>Gastos por categoria em {new Date().getFullYear()}</Text>
            {annualReport.length === 0 ? (
              <View style={s.emptyChart}>
                <Ionicons name="pie-chart-outline" size={40} color="#D1D5DB" />
                <Text style={{ color: '#9CA3AF', marginTop: 12, fontSize: 14 }}>Nenhum gasto registrado este ano.</Text>
              </View>
            ) : (
              <View style={s.annualCard}>
                {annualReport.map((item, i) => (
                  <TouchableOpacity
                    key={item.cat}
                    style={[s.annualRow, selectedMonth === item.cat && s.annualRowActive, i === annualReport.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedMonth(selectedMonth === item.cat ? null : item.cat); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={[s.catDot, { backgroundColor: CAT_COLORS[item.cat] ?? '#6B7280' }]} />
                      <Text style={s.annualCat} numberOfLines={1}>{item.cat}</Text>
                      <Text style={s.annualPct} numberOfLines={1}>{item.pct}%</Text>
                      <Text style={s.annualAmt} numberOfLines={1} adjustsFontSizeToFit>{fmt(item.amt)}</Text>
                    </View>
                    <View style={s.progBg}>
                      <View style={[s.progFill, { width: `${item.pct}%`, backgroundColor: CAT_COLORS[item.cat] ?? '#6B7280' }]} />
                    </View>
                    {selectedMonth === item.cat && (
                      <View style={s.catDetail}>
                        <Text style={s.catDetailTxt}>
                          Média mensal: {fmt(item.amt / 12)}{'\n'}
                          Representa {item.pct}% do total de gastos anuais.
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  hero: { marginHorizontal: 20, borderRadius: 28, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6 },
  heroLabel:   { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroBalance: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 0, marginBottom: 4 },
  heroSub:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 16 },
  heroRow:     { flexDirection: 'row', alignItems: 'center' },
  heroItem:    { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  heroItemTxt: { color: '#fff', fontSize: 14, fontWeight: '700', minWidth: 0 },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4, marginBottom: 16 },
  tab: { flex: 1, minWidth: 0, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabTxt: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  tabTxtActive: { color: '#111827', fontWeight: '700' },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  cardRow: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardDot: { width: 12, height: 12, borderRadius: 6 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, minWidth: 0 },
  cardSub:  { fontSize: 11, color: '#9CA3AF', marginTop: 4, minWidth: 0 },
  loanRow: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  progBg:   { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  toolBtn:  { flexGrow: 1, flexBasis: '47%', minWidth: 130, backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: '#F3F4F6' },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  toolLabel: { fontSize: 13, fontWeight: '600', color: '#111827', minWidth: 0 },
  chartCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 170 },
  barCol:  { flex: 1, alignItems: 'center', gap: 4 },
  bar:     { width: '60%', borderRadius: 4 },
  barLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  barVal:   { fontSize: 10, fontWeight: '700' },
  projCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  projNote: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  projItem: { width: 72, marginRight: 10, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1 },
  projMonth: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  projVal:   { fontSize: 13, fontWeight: '700' },
  annualCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  annualRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  annualRowActive: { backgroundColor: '#F9FAFB' },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  annualCat: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, minWidth: 0 },
  annualPct: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginRight: 8, flexShrink: 0 },
  annualAmt: { fontSize: 13, fontWeight: '700', color: '#111827', minWidth: 72, maxWidth: 118, textAlign: 'right' },
  catDetail: { backgroundColor: '#F0F7FF', borderRadius: 10, padding: 10, marginTop: 8 },
  catDetailTxt: { fontSize: 13, color: '#374151', lineHeight: 20 },
  emptyChart: { alignItems: 'center', paddingVertical: 40, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6' },
});
