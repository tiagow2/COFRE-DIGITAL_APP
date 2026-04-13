// app/(app)/(tabs)/explore.tsx — Dashboard com cartões, empréstimos e fluxo de caixa
import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CARD_COLORS: [string, string][] = [['#1a1a2e', '#2d2d5e'], ['#0d2137', '#1a3a5c'], ['#1a2a0d', '#2d4a1a']];
const MONTHS = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
const FLOW   = [70, 75, 60, 80, 50, 85];

export default function DashboardScreen() {
  const { creditCards, loans, getBalance, getMonthlyIncome, getMonthlyExpenses } = useFinance();
  const { user } = useAuth();
  const maxFlow = Math.max(...FLOW);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#1565C0', '#42A5F5']} style={s.header}>
          <View style={s.headerTop}>
            <Text style={s.greeting}>Olá, {user?.name?.split(' ')[0] ?? 'Usuário'}</Text>
          </View>
          <Text style={s.balLabel}>Saldo atual</Text>
          <Text style={s.balance}>{fmt(getBalance())}</Text>
        </LinearGradient>

        {/* Resumo */}
        <View style={s.summary}>
          <View style={s.sumCard}>
            <Text style={s.sumLabel}>Receitas</Text>
            <Text style={[s.sumVal, { color: '#059669' }]}>{fmt(getMonthlyIncome())}</Text>
          </View>
          <View style={s.sumCard}>
            <Text style={s.sumLabel}>Despesas</Text>
            <Text style={[s.sumVal, { color: '#EF4444' }]}>{fmt(getMonthlyExpenses())}</Text>
          </View>
        </View>

        {/* Cartões de crédito */}
        <Text style={s.sectionTitle}>Cartões de crédito</Text>
        {creditCards.map((card: { used: number; limit: number; id: any; name: any; lastDigits: any; dueDate: any; }, i: number) => {
          const pct = Math.round((card.used / card.limit) * 100);
          const isHigh = pct >= 80;
          return (
            <LinearGradient key={card.id} colors={CARD_COLORS[i % CARD_COLORS.length]} style={s.creditCard}>
              <Text style={s.ccBank}>{card.name} Mastercard</Text>
              <Text style={s.ccNumber}>•••• •••• •••• {card.lastDigits}</Text>
              <View style={s.ccFooter}>
                <View>
                  <Text style={s.ccLabel}>Limite usado ({pct}%)</Text>
                  <Text style={s.ccVal}>{fmt(card.used)} / {fmt(card.limit)}</Text>
                  <View style={s.ccBar}>
                    <View style={[s.ccFill, { width: `${pct}%`, backgroundColor: isHigh ? '#EF4444' : '#34D399' }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.ccLabel}>Vencimento</Text>
                  <Text style={s.ccVal}>{card.dueDate}</Text>
                </View>
              </View>
            </LinearGradient>
          );
        })}

        {creditCards.filter(c => Math.round((c.used / c.limit) * 100) >= 80).map(card => (
          <View key={card.id} style={s.alertBox}>
            <Text style={s.alertTxt}>{card.name}: {Math.round((card.used / card.limit) * 100)}% do limite usado. Considere pagar antecipado.</Text>
          </View>
        ))}

        {/* Empréstimos */}
        <Text style={s.sectionTitle}>Empréstimos e dívidas</Text>
        {loans.map((loan: { paid: number; total: number; id: any; name: any; current: any; installments: any; monthly: number; rate: any; }) => {
          const pct = Math.round((loan.paid / loan.total) * 100);
          return (
            <View key={loan.id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{loan.name}</Text>
                <View style={s.badge}><Text style={s.badgeTxt}>{loan.current}/{loan.installments}x</Text></View>
              </View>
              <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
                {loan.installments}x de {fmt(loan.monthly)} • {loan.rate}% a.m.
              </Text>
              <View style={s.progBg}>
                <View style={[s.progFill, { width: `${pct}%` }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Pago: {fmt(loan.paid)}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Restante: {fmt(loan.total - loan.paid)}</Text>
              </View>
            </View>
          );
        })}

        {/* Fluxo de caixa */}
        <Text style={s.sectionTitle}>Fluxo de caixa — próximos 6 meses</Text>
        <View style={s.card}>
          <View style={s.chartWrap}>
            {FLOW.map((v, i) => (
              <View key={i} style={s.barCol}>
                <View style={[s.bar, {
                  height: `${(v / maxFlow) * 100}%`,
                  backgroundColor: v >= 75 ? '#059669' : v >= 55 ? '#F59E0B' : '#EF4444',
                }]} />
                <Text style={s.barLabel}>{MONTHS[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
            Julho e setembro: meses com maior pressão financeira
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { marginBottom: 16 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },
  balLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  balance: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  summary: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: -24, marginBottom: 20 },
  sumCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  sumLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  sumVal: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 10, marginTop: 4 },
  creditCard: { marginHorizontal: 16, borderRadius: 18, padding: 20, marginBottom: 10 },
  ccBank: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  ccNumber: { fontSize: 16, color: '#fff', letterSpacing: 4, fontWeight: '500', marginBottom: 16 },
  ccFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ccLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  ccVal: { fontSize: 14, color: '#fff', fontWeight: '600', marginBottom: 4 },
  ccBar: { height: 4, width: 140, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  ccFill: { height: '100%', borderRadius: 2 },
  alertBox: { marginHorizontal: 16, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, marginBottom: 8 },
  alertTxt: { fontSize: 13, color: '#991B1B' },
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  badge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  progBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  chartWrap: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 8 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 8 },
  barLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
});
