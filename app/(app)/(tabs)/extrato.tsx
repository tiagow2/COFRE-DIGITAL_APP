import { useFinance } from '@/context/FinanceContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert, Image, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
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

const fmt = (v: unknown) => asNumber(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FILTERS = ['Todos', 'Receita', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Outros'];

const CAT: Record<string, { bg: string; color: string; icon: string }> = {
  Alimentação: { bg: '#FEF3C7', color: '#D97706', icon: 'restaurant-outline' },
  Transporte:  { bg: '#D1FAE5', color: '#059669', icon: 'car-outline' },
  Lazer:       { bg: '#FCE7F3', color: '#DB2777', icon: 'game-controller-outline' },
  Saúde:       { bg: '#DCFCE7', color: '#16A34A', icon: 'medical-outline' },
  Moradia:     { bg: '#DBEAFE', color: '#2563EB', icon: 'home-outline' },
  Educação:    { bg: '#EDE9FE', color: '#7C3AED', icon: 'book-outline' },
  Outros:      { bg: '#F3F4F6', color: '#4B5563', icon: 'ellipsis-horizontal-outline' },
};

// RF08 — interpreta texto em linguagem natural
function parseVoiceCmd(text: string): { filter?: string; keyword?: string } {
  const t = text.toLowerCase();
  if (/alimenta|comida|mercado|restaurante|lanche/.test(t))  return { filter: 'Alimentação' };
  if (/transport|uber|ônibus|bus|carro|gasolina/.test(t))    return { filter: 'Transporte' };
  if (/lazer|entret|cinema|jogo|stream/.test(t))             return { filter: 'Lazer' };
  if (/saúde|saude|médico|remédio|farmácia|plano/.test(t))   return { filter: 'Saúde' };
  if (/moradia|aluguel|condomínio|iptu|casa/.test(t))        return { filter: 'Moradia' };
  if (/educa|escola|curso|livro|facul/.test(t))              return { filter: 'Educação' };
  if (/receita|salário|entrada|renda/.test(t))               return { filter: 'Receita' };
  if (/todos|tudo|limpar|all/.test(t))                       return { filter: 'Todos' };
  return { keyword: text.trim().split(' ')[0] };
}

const normalizeTx = (tx: any, index: number) => {
  if (!tx || typeof tx !== 'object') return null;

  const type =
    tx.type === 'income' || tx.type === 'Receita' || tx.type === 'receita'
      ? 'income'
      : 'expense';

  const category =
    type === 'income'
      ? 'Receita'
      : asText(tx.category, 'Outros');

  return {
    ...tx,
    id: asText(tx.id, `tx-${index}`),
    type,
    category,
    description: asText(tx.description, 'Transação'),
    amount: asNumber(tx.amount),
    date: asDate(tx.date ?? tx.createdAt ?? tx.created_at).toISOString(),
  };
};

export default function ExtratoScreen() {
  const { transactions, deleteTransaction } = useFinance();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [voiceModal, setVoiceModal] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');

  const handleVoiceSearch = () => {
    const cmd = parseVoiceCmd(voiceInput);
    if (cmd.filter) { setFilter(cmd.filter); setSearch(''); }
    else if (cmd.keyword) { setSearch(cmd.keyword); setFilter('Todos'); }
    setVoiceModal(false);
    setVoiceInput('');
  };

  const filtered = useMemo(() => {
    const safeTransactions = Array.isArray(transactions)
      ? transactions
          .map((tx, index) => normalizeTx(tx, index))
          .filter(Boolean)
      : [];

    let list = safeTransactions as any[];

    if (filter === 'Todos') {
      list = safeTransactions as any[];
    } else if (filter === 'Receita') {
      list = list.filter(t => t.type === 'income');
    } else {
      list = list.filter(t => t.type === 'expense' && t.category === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();

      list = list.filter(t =>
        asText(t.description).toLowerCase().includes(q) ||
        asText(t.category).toLowerCase().includes(q)
      );
    }

    return list.sort(
      (a, b) => asDate(b.date).getTime() - asDate(a.date).getTime()
    );
  }, [transactions, filter, search]);

  const totalInc = filtered
    .filter(t => t?.type === 'income')
    .reduce((s, t) => s + asNumber(t.amount), 0);

  const totalExp = filtered
    .filter(t => t?.type === 'expense')
    .reduce((s, t) => s + asNumber(t.amount), 0);

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
    for (const tx of filtered) {
      const key = asDate(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>Extrato</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(app)/(tabs)/boleto-scanner' as never)}>
            <Ionicons name="barcode-outline" size={22} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceModal(true); }}>
            <Ionicons name="mic-outline" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumo */}
      <View style={s.summary}>
        {[
          { label: 'Receitas', value: totalInc, color: '#059669' },
          { label: 'Despesas', value: totalExp, color: '#EF4444' },
          { label: 'Saldo', value: totalInc - totalExp, color: totalInc - totalExp >= 0 ? '#059669' : '#EF4444' },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>{item.label}</Text>
              <Text style={[s.summaryValue, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(item.value)}</Text>
            </View>
            {i < arr.length - 1 && <View style={s.summaryDivider} />}
          </React.Fragment>
        ))}
      </View>

      {/* Busca */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginLeft: 14 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar transações..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingRight: 12 }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => { Haptics.selectionAsync(); setFilter(f); }}>
            <Text style={[s.chipTxt, filter === f && s.chipTxtActive]} numberOfLines={1}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {grouped.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={44} color="#D1D5DB" />
            <Text style={s.emptyTitle}>Nenhuma transação encontrada</Text>
            <Text style={s.emptyDesc}>{search || filter !== 'Todos' ? 'Tente outro filtro.' : 'Adicione sua primeira transação.'}</Text>
          </View>
        ) : grouped.map(([date, txs]) => (
          <View key={date}>
            <Text style={s.dateGroup}>{date}</Text>
            <View style={s.txCard}>
              {txs.map((tx: any, i: number) => {
                const ci = catInfo(tx);
                return (
                  <TouchableOpacity key={asText(tx.id, `${date}-${i}`)} style={[s.txRow, i === txs.length - 1 && { borderBottomWidth: 0 }]} onPress={() => setSelectedTx(tx)} activeOpacity={0.75}>
                    <View style={[s.txIcon, { backgroundColor: ci.bg }]}>
                      <Ionicons name={ci.icon as any} size={18} color={ci.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.txDesc} numberOfLines={1}>{asText(tx.description, 'Transação')}</Text>
                      <Text style={s.txCat} numberOfLines={1}>
                        {tx.creditCardName
                          ? `${asText(tx.category, 'Outros')} - ${asText(tx.creditCardName, 'Cartão')}`
                          : asText(tx.category, tx.type === 'income' ? 'Receita' : 'Outros')}
                      </Text>
                    </View>
                    {tx.photo && <Ionicons name="camera-outline" size={13} color="#9CA3AF" style={{ marginRight: 6 }} />}
                    <Text style={[s.txAmt, { color: tx.type === 'income' ? '#059669' : '#EF4444' }]} numberOfLines={1} adjustsFontSizeToFit>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal: Detalhe */}
      <Modal visible={!!selectedTx} animationType="slide" transparent onRequestClose={() => setSelectedTx(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelectedTx(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            {selectedTx && (() => {
              const ci = catInfo(selectedTx);
              return (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <View style={[s.txIcon, { width: 60, height: 60, borderRadius: 22, backgroundColor: ci.bg, marginBottom: 10 }]}>
                      <Ionicons name={ci.icon as any} size={26} color={ci.color} />
                    </View>
                    <Text style={[s.txAmt, { fontSize: 28, color: selectedTx.type === 'income' ? '#059669' : '#EF4444' }]}>
                      {selectedTx.type === 'income' ? '+' : '-'}{fmt(selectedTx.amount)}
                    </Text>
                    <Text style={{ fontSize: 16, color: '#374151', fontWeight: '500', marginTop: 4 }} numberOfLines={2}>{asText(selectedTx.description, 'Transação')}</Text>
                  </View>
                  <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 4, marginBottom: 16 }}>
                    {[
                      ['Categoria', asText(selectedTx.category, selectedTx.type === 'income' ? 'Receita' : 'Outros')],
                      ['Tipo', selectedTx.type === 'income' ? 'Receita' : 'Despesa'],
                      ['Pagamento', selectedTx.creditCardName ? `Cartão - ${selectedTx.creditCardName}` : 'Saldo da conta'],
                      ['Data', asDate(selectedTx.date).toLocaleDateString('pt-BR')],
                    ].map(([l, v]) => (
                      <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12 }}>
                        <Text style={{ color: '#9CA3AF', fontSize: 13 }}>{l}</Text>
                        <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' }} numberOfLines={2}>{v}</Text>
                      </View>
                    ))}
                  </View>
                  {selectedTx.photo && <Image source={{ uri: selectedTx.photo }} style={{ width: '100%', height: 160, borderRadius: 14, marginBottom: 16 }} resizeMode="cover" />}
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, height: 50 }}
                    onPress={() => Alert.alert('Excluir', 'Tem certeza?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => { deleteTransaction(selectedTx.id); setSelectedTx(null); } }])}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Excluir transação</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Busca por voz (RF08 — input de texto simulando voz) */}
      <Modal visible={voiceModal} animationType="slide" transparent onRequestClose={() => setVoiceModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setVoiceModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="mic" size={30} color="#1565C0" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Busca por voz</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }}>
                Digite o que você diria, ex:{'\n'}alimentação de janeiro ou transporte
              </Text>
            </View>
            <TextInput
              style={[s.searchRow, { height: 52, fontSize: 15, color: '#111827', paddingHorizontal: 16, marginBottom: 16 }]}
              placeholder='Ex: "gastos de saúde", "alimentação"...'
              placeholderTextColor="#9CA3AF"
              value={voiceInput}
              onChangeText={setVoiceInput}
              autoFocus
              onSubmitEditing={handleVoiceSearch}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }} onPress={() => setVoiceModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#1565C0', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }} onPress={handleVoiceSearch}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Buscar</Text>
              </TouchableOpacity>
            </View>
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
  summary: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  summaryItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '700', minWidth: 0 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#F3F4F6', marginHorizontal: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, height: 48 },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 10, fontSize: 15, color: '#111827' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipTxt: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '700' },
  dateGroup: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  txCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  txIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#111827', minWidth: 0 },
  txCat: { fontSize: 12, color: '#9CA3AF', marginTop: 2, minWidth: 0 },
  txAmt: { fontSize: 14, fontWeight: '700', flexShrink: 0, maxWidth: 132 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
});
