// app/(app)/(tabs)/index.tsx

import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CATEGORIES = [
  { name: 'Alimentação', icon: 'A', bg: '#FEF3C7' },
  { name: 'Transporte',  icon: 'T', bg: '#D1FAE5' },
  { name: 'Lazer',       icon: 'L', bg: '#FCE7F3' },
  { name: 'Saúde',       icon: 'S', bg: '#DCFCE7' },
  { name: 'Moradia',     icon: 'M', bg: '#DBEAFE' },
  { name: 'Educação',    icon: 'E', bg: '#EDE9FE' },
  { name: 'Outros',      icon: 'O', bg: '#F3F4F6' },
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { transactions, budgets, addTransaction, getBalance, getMonthlyIncome, getMonthlyExpenses, getBudgetStatus, suggestCategory } = useFinance();

  const [modal, setModal]     = useState(false);
  const [txType, setTxType]   = useState<'expense' | 'income'>('expense');
  const [desc, setDesc]       = useState('');
  const [amount, setAmount]   = useState('');
  const [category, setCategory] = useState('Alimentação');

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
  const balance   = getBalance();
  const recent    = transactions.slice(0, 5);

  const handleDescChange = (t: string) => {
    setDesc(t);
    if (t.length > 2) setCategory(suggestCategory(t));
  };

  const handleAdd = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (!desc.trim())         { Alert.alert('Erro', 'Informe a descrição.'); return; }
    if (!val || val <= 0)     { Alert.alert('Erro', 'Informe um valor válido.'); return; }
    const cat = CATEGORIES.find(c => c.name === category);
    addTransaction({ type: txType, description: desc, amount: val, category, icon: txType === 'income' ? 'R' : (cat?.icon ?? 'O') });
    setDesc(''); setAmount(''); setCategory('Alimentação'); setModal(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Olá, {firstName}</Text>
              <Text style={styles.appTitle}>Cofre Digital</Text>
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => Alert.alert('Sair', 'Deseja sair da conta?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: logout },
              ])}
            >
              <Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.balLabel}>Saldo disponível</Text>
          <Text style={[styles.balance, balance < 0 && { color: '#FCA5A5' }]}>{fmt(balance)}</Text>

          <View style={styles.balRow}>
            <View style={styles.balMini}>
              <Text style={styles.balMiniLabel}>↑ Receitas</Text>
              <Text style={styles.balMiniVal}>{fmt(getMonthlyIncome())}</Text>
            </View>
            <View style={[styles.balMini, { alignItems: 'flex-end' }]}>
              <Text style={styles.balMiniLabel}>↓ Despesas</Text>
              <Text style={styles.balMiniVal}>{fmt(getMonthlyExpenses())}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setTxType('expense'); setModal(true); }}>
            <Text style={styles.actionIcon}>-</Text>
            <Text style={styles.actionLabel}>Despesa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => { setTxType('income'); setModal(true); }}>
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionLabel}>Receita</Text>
          </TouchableOpacity>
        </View>

        {/* Orçamentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orçamento do mês</Text>
          <View style={styles.card}>
            {budgets.map((b: { id: any; category: any; limit: number; }) => {
              const { spent, pct, remaining } = getBudgetStatus(b);
              const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#1D9E75';
              return (
                <View key={b.id} style={styles.budgetItem}>
                  <View style={styles.budgetHeader}>
                    <Text style={styles.budgetName}>{b.category}</Text>
                    <View style={[styles.badge, { backgroundColor: pct >= 90 ? '#FEE2E2' : pct >= 70 ? '#FEF3C7' : '#D1FAE5' }]}>
                      <Text style={[styles.badgeText, { color: pct >= 90 ? '#991B1B' : pct >= 70 ? '#92400E' : '#065F46' }]}>{pct}%</Text>
                    </View>
                  </View>
                  <View style={styles.progBg}>
                    <View style={[styles.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                  </View>
                  <View style={styles.budgetFooter}>
                    <Text style={styles.budgetDetail}>{fmt(spent)} / {fmt(b.limit)}</Text>
                    {pct >= 90
                      ? <Text style={{ color: '#EF4444', fontSize: 11 }}>Limite quase cheio</Text>
                      : <Text style={styles.budgetDetail}>{fmt(remaining)} restantes</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Últimas transações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas transações</Text>
          <View style={styles.card}>
            {recent.length === 0
              ? <Text style={styles.empty}>Nenhuma transação ainda.</Text>
              : recent.map((tx: { category: string; id: any; icon: any; description: any; date: string | number | Date; type: string; amount: number; }) => {
                  const cat = CATEGORIES.find(c => c.name === tx.category);
                  return (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={[styles.txIcon, { backgroundColor: cat?.bg ?? '#F3F4F6' }]}>
                        <Text style={{ fontSize: 18 }}>{tx.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txName}>{tx.description}</Text>
                        <Text style={styles.txCat}>{tx.category} • {new Date(tx.date).toLocaleDateString('pt-BR')}</Text>
                      </View>
                      <Text style={[styles.txAmt, tx.type === 'income' ? styles.pos : styles.neg]}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </Text>
                    </View>
                  );
                })
            }
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModal(true)}>
        <Text style={{ color: '#fff', fontSize: 28 }}>+</Text>
      </TouchableOpacity>

      {/* Modal Nova Transação */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Nova transação</Text>

            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'expense' && styles.typeBtnDanger]}
                onPress={() => setTxType('expense')}
              >
                <Text style={[styles.typeTxt, txType === 'expense' && { color: '#991B1B' }]}>Despesa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'income' && styles.typeBtnSuccess]}
                onPress={() => setTxType('income')}
              >
                <Text style={[styles.typeTxt, txType === 'income' && { color: '#065F46' }]}>Receita</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Valor (R$)</Text>
            <TextInput style={styles.modalInput} placeholder="0,00" placeholderTextColor="#9CA3AF" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Descrição</Text>
            <TextInput style={styles.modalInput} placeholder="Ex: Supermercado..." placeholderTextColor="#9CA3AF" value={desc} onChangeText={handleDescChange} />

            {txType === 'expense' && (
              <>
                <Text style={styles.fieldLabel}>
                  Categoria {desc.length > 2 && <Text style={{ color: '#1565C0' }}>(sugerida)</Text>}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.name}
                      style={[styles.chip, category === c.name && styles.chipActive]}
                      onPress={() => setCategory(c.name)}
                    >
                      <Text style={[styles.chipTxt, category === c.name && { color: '#1565C0', fontWeight: '600' }]}>
                        {c.icon} {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
              <Text style={styles.submitTxt}>Adicionar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  appTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  balance: { color: '#fff', fontSize: 34, fontWeight: '700', marginTop: 4, marginBottom: 16 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balMini: { flex: 1 },
  balMiniLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  balMiniVal: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 2 },

  actions: { flexDirection: 'row', gap: 12, margin: 16, marginTop: -20 },
  actionBtn: { flex: 1, backgroundColor: '#1565C0', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  actionBtnGreen: { backgroundColor: '#059669' },
  actionIcon: { fontSize: 20, marginBottom: 4 },
  actionLabel: { color: '#fff', fontWeight: '600', fontSize: 13 },

  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },

  budgetItem: { marginBottom: 14 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  progBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  budgetDetail: { fontSize: 12, color: '#9CA3AF' },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  txIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txCat: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '600' },
  pos: { color: '#059669' },
  neg: { color: '#EF4444' },
  empty: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 20 },

  fab: { position: 'absolute', right: 20, bottom: 80, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#111827' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  typeBtnDanger: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  typeBtnSuccess: { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  typeTxt: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', marginRight: 8 },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#1565C0' },
  chipTxt: { fontSize: 13, color: '#6B7280' },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
