import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asDate = (value: unknown) => {
  const date = new Date(asText(value, new Date().toISOString()));
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const fmt = (value: unknown) =>
  asNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FILTERS = ['Todos', 'Receita', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Outros'];

const CAT: Record<string, { bg: string; color: string; icon: string }> = {
  Alimentação: { bg: '#FEF3C7', color: '#D97706', icon: 'restaurant-outline' },
  Transporte: { bg: '#D1FAE5', color: '#059669', icon: 'car-outline' },
  Lazer: { bg: '#FCE7F3', color: '#DB2777', icon: 'game-controller-outline' },
  Saúde: { bg: '#DCFCE7', color: '#16A34A', icon: 'medical-outline' },
  Moradia: { bg: '#DBEAFE', color: '#2563EB', icon: 'home-outline' },
  Educação: { bg: '#EDE9FE', color: '#7C3AED', icon: 'book-outline' },
  Outros: { bg: '#F3F4F6', color: '#4B5563', icon: 'ellipsis-horizontal-outline' },
};

const normalizeTx = (tx: any, index: number) => {
  if (!tx || typeof tx !== 'object') return null;

  const type =
    tx.type === 'income' || tx.type === 'Receita' || tx.type === 'receita'
      ? 'income'
      : 'expense';

  const category = type === 'income' ? 'Receita' : asText(tx.category, 'Outros');

  return {
    ...tx,
    id: asText(tx.id, `tx-${index}`),
    type,
    category: category.trim(),
    description: asText(tx.description, 'Transação'),
    amount: asNumber(tx.amount),
    date: asDate(tx.date ?? tx.createdAt ?? tx.created_at).toISOString(),
  };
};

export default function ExtratoScreen() {
  const { transactions, deleteTransaction } = useFinance();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useFinancialTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const userTransactions = useMemo(() => {
    if (!user?.uid) return [];
    return transactions.filter((t: any) => t.userId === user.uid || t.user_id === user.uid);
  }, [transactions, user?.uid]);

  const safeTransactions = useMemo(() => {
    return Array.isArray(transactions)
      ? userTransactions.map((tx: any, index: number) => normalizeTx(tx, index)).filter(Boolean)
      : [];
  }, [userTransactions]);

  const filtered = useMemo(() => {
    let list = safeTransactions as any[];

    if (filter === 'Todos') {
      list = safeTransactions as any[];
    } else if (filter === 'Receita') {
      list = list.filter((t) => t.type === 'income');
    } else {
      list = list.filter((t) => t.type === 'expense' && t.category === filter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((t) =>
        asText(t.description).toLowerCase().includes(query) ||
        asText(t.category).toLowerCase().includes(query)
      );
    }

    return list.sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime());
  }, [safeTransactions, filter, search]);

  const totalInc = filtered
    .filter((t) => t?.type === 'income')
    .reduce((sum, tx) => sum + asNumber(tx.amount), 0);

  const totalAccExp = filtered
    .filter((t) => t?.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance'))
    .reduce((sum, tx) => sum + asNumber(tx.amount), 0);

  const totalCardExp = filtered
    .filter((t) => t?.type === 'expense' && t.paymentMethod === 'credit_card')
    .reduce((sum, tx) => sum + asNumber(tx.amount), 0);

  // Saldo dinâmico: Subtrai apenas o que de fato saiu da conta
  const currentBalance = totalInc - totalAccExp;

  const catInfo = (tx: any) => {
    if (!tx) return CAT.Outros;

    if (tx.type === 'income') {
      return {
        bg: '#D1FAE5',
        color: '#059669',
        icon: 'arrow-down-circle-outline',
      };
    }

    return CAT[asText(tx.category, 'Outros')] ?? CAT.Outros;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();

    filtered.forEach((tx) => {
      const date = asDate(tx.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const items = map.get(date) ?? [];
      map.set(date, [...items, tx]);
    });

    return Array.from(map.entries());
  }, [filtered]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>Extrato</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => router.push('/(app)/(tabs)/boleto-scanner' as never)}
        >
          <Ionicons name="barcode-outline" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={s.summary}>
        {[
          { label: 'Receitas', value: totalInc, color: '#059669', bg: '#D1FAE5' },
          { label: 'Na Conta', value: totalAccExp, color: '#EF4444', bg: '#FEE2E2' },
          { label: 'No Cartão', value: totalCardExp, color: '#D97706', bg: '#FEF3C7' },
          { label: 'Saldo', value: currentBalance, color: currentBalance >= 0 ? '#059669' : '#EF4444', bg: currentBalance >= 0 ? '#D1FAE5' : '#FEE2E2' },
        ].map((item, index, arr) => (
          <React.Fragment key={item.label}>
            <View style={[s.summaryItem, { backgroundColor: item.bg }]}>
              <Text style={s.summaryLabel}>{item.label}</Text>
              <Text style={[s.summaryValue, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(item.value)}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginLeft: 14 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar transações..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtersWrap}
        contentContainerStyle={s.filtersContent}
      >
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[s.chip, filter === item && { backgroundColor: theme.accent }]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(item);
            }}
          >
            <Text style={[s.chipTxt, filter === item && s.chipTxtActive]} numberOfLines={1}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={grouped}
        keyExtractor={(item, index) => `${item[0]}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={44} color="#D1D5DB" />
            <Text style={s.emptyTitle}>Nenhuma transação encontrada</Text>
            <Text style={s.emptyDesc}>
              {search || filter !== 'Todos' ? 'Tente outro filtro.' : 'Adicione sua primeira transação.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const [date, txs] = item;

          return (
            <View>
              <Text style={s.dateGroup}>{date}</Text>
              <View style={s.txCard}>
                {txs.map((tx: any, index: number) => {
                  const info = catInfo(tx);

                  return (
                    <TouchableOpacity
                      key={`${tx.id}-${index}`}
                      style={[s.txRow, index === txs.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => setSelectedTx(tx)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.txIcon, { backgroundColor: info.bg }]}>
                        <Ionicons name={info.icon as any} size={18} color={info.color} />
                      </View>
                      <View style={s.txTextBlock}>
                        <Text style={s.txDesc} numberOfLines={1}>
                          {asText(tx.description, 'Transação')}
                        </Text>
                        <Text style={s.txCat} numberOfLines={1}>
                          {tx.creditCardName
                            ? `${asText(tx.category, 'Outros')} • 💳 ${asText(tx.creditCardName, 'Cartão')}`
                            : asText(tx.category, tx.type === 'income' ? 'Receita' : 'Outros')}
                        </Text>
                      </View>
                      {!!tx.photo && <Ionicons name="camera-outline" size={13} color="#9CA3AF" />}
                      <Text
                        style={[s.txAmt, { color: tx.type === 'income' ? '#059669' : '#EF4444' }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
      </KeyboardAvoidingView>

      <Modal visible={!!selectedTx} animationType="slide" transparent onRequestClose={() => setSelectedTx(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelectedTx(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            {selectedTx && (
              <>
                <View style={s.detailHeader}>
                  <View style={[s.detailIcon, { backgroundColor: catInfo(selectedTx).bg }]}>
                    <Ionicons name={catInfo(selectedTx).icon as any} size={26} color={catInfo(selectedTx).color} />
                  </View>
                  <Text
                    style={[s.detailAmount, { color: selectedTx.type === 'income' ? '#059669' : '#EF4444' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {selectedTx.type === 'income' ? '+' : '-'}{fmt(selectedTx.amount)}
                  </Text>
                  <Text style={s.detailDescription} numberOfLines={2}>
                    {asText(selectedTx.description, 'Transação')}
                  </Text>
                </View>

                <View style={s.detailBox}>
                  {[
                    ['Categoria', asText(selectedTx.category, selectedTx.type === 'income' ? 'Receita' : 'Outros')],
                    ['Tipo', selectedTx.type === 'income' ? 'Receita' : 'Despesa'],
                    ['Pagamento', selectedTx.creditCardName ? `Cartão - ${selectedTx.creditCardName}` : 'Saldo da conta'],
                    ['Data', asDate(selectedTx.date).toLocaleDateString('pt-BR')],
                  ].map(([label, value]) => (
                    <View key={label} style={s.detailRow}>
                      <Text style={s.detailLabel}>{label}</Text>
                      <Text style={s.detailValue} numberOfLines={2}>{value}</Text>
                    </View>
                  ))}
                </View>

                {!!selectedTx.photo && (
                  <Image source={{ uri: selectedTx.photo }} style={s.receiptImage} resizeMode="cover" />
                )}

                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => Alert.alert('Excluir', 'Tem certeza?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: () => {
                        deleteTransaction(selectedTx.id);
                        setSelectedTx(null);
                      },
                    },
                  ])}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={s.deleteTxt}>Excluir transação</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginHorizontal: 20, marginBottom: 20 },
  summaryItem: { flexBasis: '48%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  summaryLabel: { fontSize: 12, color: '#4B5563', fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '800', minWidth: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 16, height: 56, paddingHorizontal: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 10, fontSize: 15, color: '#111827', fontWeight: '500' },
  clearSearchBtn: { paddingRight: 12, paddingVertical: 10 },
  filtersWrap: { flexGrow: 0, minHeight: 48, marginBottom: 16 },
  filtersContent: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: '#F1F5F9', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: '#111827' },
  chipTxt: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '700' },
  listContent: { paddingBottom: 120 },
  dateGroup: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  txCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#F8FAFC', marginBottom: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  txIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txTextBlock: { flex: 1, minWidth: 0 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#111827', minWidth: 0 },
  txCat: { fontSize: 12, color: '#9CA3AF', marginTop: 2, minWidth: 0 },
  txAmt: { fontSize: 14, fontWeight: '700', flexShrink: 0, maxWidth: 132 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailAmount: { fontSize: 28, fontWeight: '800', maxWidth: '100%' },
  detailDescription: { fontSize: 16, color: '#374151', fontWeight: '500', marginTop: 4, textAlign: 'center' },
  detailBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 4, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  detailLabel: { color: '#9CA3AF', fontSize: 13 },
  detailValue: { color: '#111827', fontSize: 14, fontWeight: '600', flex: 1, minWidth: 0, textAlign: 'right' },
  receiptImage: { width: '100%', height: 160, borderRadius: 14, marginBottom: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, height: 50 },
  deleteTxt: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
});
