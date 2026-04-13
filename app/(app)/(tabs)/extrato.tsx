// app/(app)/(tabs)/extrato.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, SafeAreaView, Alert } from 'react-native';
import { useFinance } from '@/context/FinanceContext';

const CAT_BG: Record<string, string> = {
  'Alimentação': '#FEF3C7', 'Transporte': '#D1FAE5', 'Lazer': '#FCE7F3',
  'Saúde': '#DCFCE7', 'Moradia': '#DBEAFE', 'Educação': '#EDE9FE',
  'Outros': '#F3F4F6', 'Receita': '#D1FAE5',
};
const FILTERS = ['Todos', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Receita'];
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExtractScreen() {
  const { transactions, deleteTransaction, getMonthlyIncome, getMonthlyExpenses } = useFinance();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('Todos');

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filter !== 'Todos') {
      list = filter === 'Receita'
        ? list.filter(t => t.type === 'income')
        : list.filter(t => t.category === filter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(t => t.description.toLowerCase().includes(s) || t.category.toLowerCase().includes(s));
    }
    return list;
  }, [transactions, filter, search]);

  const grouped = useMemo(() => {
    const g: Record<string, { label: string; items: typeof transactions }> = {};
    filtered.forEach((tx: { date: string | number | Date; }) => {
      const d = new Date(tx.date);
      const key = `${d.getMonth()}/${d.getFullYear()}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!g[key]) g[key] = { label, items: [] };
      g[key].items.push(tx);
    });
    return Object.values(g);
  }, [filtered]);

  const handleDelete = (id: string, name: string) =>
    Alert.alert('Excluir', `Excluir "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteTransaction(id) },
    ]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Extrato</Text>
        <TouchableOpacity onPress={() => Alert.alert('🎙️ Busca por voz', '"mostrar despesas de alimentação"\n\n(Integre @react-native-voice/voice para voz real)', [{ text: 'OK', onPress: () => setFilter('Alimentação') }])}>
          <View style={s.voiceBtn}><Text style={{ fontSize: 20 }}>🎙️</Text></View>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Buscar transações..." placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: '#9CA3AF' }}>✕</Text></TouchableOpacity> : null}
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}><Text style={s.statLabel}>Entradas</Text><Text style={[s.statVal, { color: '#059669' }]}>{fmt(getMonthlyIncome())}</Text></View>
        <View style={s.statCard}><Text style={s.statLabel}>Saídas</Text><Text style={[s.statVal, { color: '#EF4444' }]}>{fmt(getMonthlyExpenses())}</Text></View>
      </View>

      <FlatList
        horizontal data={FILTERS} keyExtractor={i => i} showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44, marginBottom: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[s.chip, filter === item && s.chipActive]} onPress={() => setFilter(item)}>
            <Text style={[s.chipTxt, filter === item && s.chipTxtActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={grouped} keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={s.empty}>Nenhuma transação encontrada.</Text>}
        renderItem={({ item: group }) => (
          <View>
            <Text style={s.groupLabel}>{group.label.charAt(0).toUpperCase() + group.label.slice(1)}</Text>
            <View style={s.card}>
              {group.items.map((tx: { id: React.Key | null | undefined; description: string; category: string | number; icon: any; date: string | number | Date; type: string; amount: number; }) => (
                <TouchableOpacity key={tx.id} style={s.txRow} onLongPress={() => handleDelete(tx.id, tx.description)} activeOpacity={0.7}>
                  <View style={[s.txIcon, { backgroundColor: CAT_BG[tx.category] ?? '#F3F4F6' }]}><Text style={{ fontSize: 18 }}>{tx.icon}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txName}>{tx.description}</Text>
                    <Text style={s.txCat}>{tx.category} • {new Date(tx.date).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <Text style={[s.txAmt, tx.type === 'income' ? s.pos : s.neg]}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  voiceBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  statVal: { fontSize: 18, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#1565C0' },
  chipTxt: { fontSize: 13, color: '#6B7280' },
  chipTxtActive: { color: '#1565C0', fontWeight: '600' },
  groupLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txCat: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '600' },
  pos: { color: '#059669' },
  neg: { color: '#EF4444' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
