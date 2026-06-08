import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Expense { description: string; amount: number; paidBy: string; }
interface Group { id: string; name: string; members: string[]; expenses: Expense[]; }

export default function SplitExpensesScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupModal, setGroupModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState<Group | null>(null);
  const [gName, setGName] = useState('');
  const [members, setMembers] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('');

  const calcBalance = (g: Group) => {
    const total = g.expenses.reduce((s, e) => s + e.amount, 0);
    const perPerson = total / g.members.length;
    return g.members.map(m => ({
      name: m,
      balance: g.expenses.filter(e => e.paidBy === m).reduce((s, e) => s + e.amount, 0) - perPerson,
    }));
  };

  const handleCreateGroup = () => {
    if (!gName.trim()) { Alert.alert('Erro', 'Informe o nome do grupo.'); return; }
    const memberList = ['Você', ...members.split(',').map(m => m.trim()).filter(Boolean)];
    setGroups(g => [...g, { id: Date.now().toString(), name: gName, members: memberList, expenses: [] }]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGroupModal(false); setGName(''); setMembers('');
  };

  const handleAddExpense = () => {
    if (!expenseModal) return;
    const a = parseCurrencyInput(expAmt);
    if (!expDesc.trim() || !Number.isFinite(a) || a <= 0) { Alert.alert('Erro', 'Preencha todos os campos.'); return; }
    const paidBy = expPaidBy.trim() || expenseModal.members[0];
    setGroups(gs => gs.map(g => g.id === expenseModal.id
      ? { ...g, expenses: [...g.expenses, { description: expDesc, amount: a, paidBy }] }
      : g));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setExpenseModal(null); setExpDesc(''); setExpAmt(''); setExpPaidBy('');
  };

  const handleSendReminder = (memberName: string, amount: number, groupName: string) => {
    Alert.alert(
      `Cobrar ${memberName}`,
      `Mensagem para enviar:\n\n"Olá ${memberName}! Você deve ${fmt(amount)} ao grupo '${groupName}'. Por favor, faça o pagamento 💰"\n\nCopie e envie pelo WhatsApp ou SMS.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Divisão de Gastos</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: theme.accent }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setGroupModal(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {groups.map(g => {
          const balances = calcBalance(g);
          const total = g.expenses.reduce((s, e) => s + e.amount, 0);
          return (
            <View key={g.id} style={s.groupCard}>
              <View style={s.groupHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                  <Text style={s.groupSub}>{g.members.length} membros · {g.expenses.length} despesas</Text>
                </View>
                <Text style={s.groupTotal} numberOfLines={1} adjustsFontSizeToFit>{fmt(total)}</Text>
              </View>

              {balances.map(b => (
                <View key={b.name} style={s.balanceRow}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{b.name[0]}</Text></View>
                  <Text style={s.memberName} numberOfLines={1}>{b.name}</Text>
                  <Text style={[s.memberBalance, { color: b.balance >= 0 ? '#059669' : '#EF4444' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {b.balance >= 0 ? '+' : ''}{fmt(b.balance)}
                  </Text>
                  {b.balance < 0 && b.name !== 'Você' && (
                    <TouchableOpacity style={s.reminderBtn} onPress={() => handleSendReminder(b.name, Math.abs(b.balance), g.name)}>
                      <Ionicons name="paper-plane-outline" size={16} color="#1565C0" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={s.addExpenseBtn} onPress={() => { setExpPaidBy(g.members[0]); setExpenseModal(g); }}>
                <Ionicons name="add-circle-outline" size={16} color="#1565C0" />
                <Text style={s.addExpenseTxt}>Adicionar despesa</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {groups.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={44} color="#D1D5DB" />
            <Text style={s.emptyTitle}>Nenhum grupo criado</Text>
            <Text style={s.emptyDesc}>Crie um grupo para dividir despesas com amigos ou família.</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal: Novo grupo */}
      <Modal visible={groupModal} animationType="slide" transparent onRequestClose={() => setGroupModal(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Novo grupo</Text>
            <Text style={s.fieldLabel}>Nome do grupo</Text>
            <TextInput style={s.input} placeholder="Ex: República, Viagem, Casamento..." placeholderTextColor="#9CA3AF" value={gName} onChangeText={setGName} />
            <Text style={s.fieldLabel}>Membros (separados por vírgula)</Text>
            <TextInput style={[s.input, { marginBottom: 24 }]} placeholder="Ana, Carlos, Maria..." placeholderTextColor="#9CA3AF" value={members} onChangeText={setMembers} />
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleCreateGroup}>
              <Text style={s.saveBtnTxt}>Criar grupo</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Nova despesa */}
      <Modal visible={!!expenseModal} animationType="slide" transparent onRequestClose={() => setExpenseModal(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Nova despesa</Text>
            <Text style={s.fieldLabel}>Descrição</Text>
            <TextInput style={s.input} placeholder="Ex: Aluguel, Luz, Mercado..." placeholderTextColor="#9CA3AF" value={expDesc} onChangeText={setExpDesc} />
            <Text style={s.fieldLabel}>Valor (R$)</Text>
            <TextInput style={s.input} placeholder="0,00" placeholderTextColor="#9CA3AF" value={expAmt} onChangeText={setExpAmt} keyboardType="numeric" />
            <Text style={s.fieldLabel}>Pago por</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {expenseModal?.members.map(m => (
                <TouchableOpacity key={m} style={[s.memberChip, expPaidBy === m && s.memberChipActive]} onPress={() => setExpPaidBy(m)}>
                  <Text style={[s.memberChipTxt, expPaidBy === m && { color: '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleAddExpense}>
              <Text style={s.saveBtnTxt}>Adicionar despesa</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center' },
  groupCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  groupName: { fontSize: 17, fontWeight: '700', color: '#111827', minWidth: 0 },
  groupSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2, minWidth: 0 },
  groupTotal: { fontSize: 18, fontWeight: '800', color: '#111827', flexShrink: 0, maxWidth: 140 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1, minWidth: 0 },
  memberBalance: { fontSize: 14, fontWeight: '700', flexShrink: 0, maxWidth: 132 },
  reminderBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  addExpenseTxt: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  saveBtn: { backgroundColor: '#111827', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  memberChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', marginRight: 8 },
  memberChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  memberChipTxt: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
});
