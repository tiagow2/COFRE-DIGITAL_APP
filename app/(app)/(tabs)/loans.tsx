import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';
import { useFinance } from '@/context/FinanceContext';
import { loanService, Loan } from '@/services/loanService';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function LoansScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  const { user } = useAuth();
  const { transactions, addTransaction, creditCards } = useFinance();

  const userTransactions = useMemo(() => {
    if (!user?.uid) return [];
    return transactions.filter((t: any) => {
      const ownerId = t.userId ?? t.user_id;
      return !ownerId || ownerId === user.uid;
    });
  }, [transactions, user?.uid]);

  const userCards = useMemo(() => {
    if (!user?.uid) return [];
    return creditCards.filter((c: any) => {
      const ownerId = c.userId ?? c.user_id;
      return !ownerId || ownerId === user.uid;
    });
  }, [creditCards, user?.uid]);

  const balance = useMemo(() => {
    const inc = userTransactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const exp = userTransactions.filter((t: any) => t.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance')).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    return inc - exp;
  }, [userTransactions]);
  
  const [localLoans, setLocalLoans] = useState<Loan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModal, setPaymentModal] = useState<Loan | null>(null);
  const [newName, setNewName] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newInstallments, setNewInstallments] = useState('');
  const [newInstallmentValue, setNewInstallmentValue] = useState('');

  const loadLoans = async () => {
    if (user?.uid) {
      const data = await loanService.listLoans(user.uid);
      setLocalLoans(data);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLoans();
    }, [user?.uid])
  );

  const handleCreate = async () => {
    if (!user?.uid) return;
    if (!newName.trim()) return Alert.alert('Erro', 'Insira o nome da dívida.');
    const total = parseCurrencyInput(newTotal);
    const inst = parseInt(newInstallments);
    const instVal = parseCurrencyInput(newInstallmentValue);
    
    if (total <= 0 || inst <= 0 || instVal <= 0) return Alert.alert('Erro', 'Valores inválidos.');

    if (instVal > total) {
      return Alert.alert('Atenção', 'O valor de uma única parcela não pode ser maior que o valor total do financiamento/dívida. Verifique os dados informados.');
    }

    const totalWithInterest = instVal * inst;
    if (totalWithInterest > total) {
      Alert.alert(
        'Aviso sobre Juros',
        `O total das parcelas (${fmt(totalWithInterest)}) ultrapassa o valor do bem (${fmt(total)}). Isso é normal devido aos juros do financiamento. Deseja registrar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar', onPress: () => executeCreate(total, inst, instVal) }
        ]
      );
      return;
    }

    executeCreate(total, inst, instVal);
  };

  const executeCreate = async (total: number, inst: number, instVal: number) => {
    if (!user?.uid) return;
    try {
      await loanService.addLoan(user.uid, {
        id: Date.now().toString(),
        name: newName.trim(),
        totalAmount: total,
        installments: inst,
        installmentValue: instVal,
      });
      
      setModalVisible(false);
      setNewName(''); setNewTotal(''); setNewInstallments(''); setNewInstallmentValue('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadLoans();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o empréstimo.');
    }
  };

  const handlePayClick = (loan: Loan) => {
    setPaymentModal(loan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const processPayment = async (loan: Loan, method: 'balance' | 'credit_card', card?: any) => {
    if (!user?.uid) return;
    
    // Validação de Cartão
    if (method === 'credit_card' && card) {
      const available = (card.limit || card.limitAmount || 0) - (card.used || 0);
      if (loan.installmentValue > available) {
        return Alert.alert('Limite Insuficiente', `O cartão ${card.name} não possui limite disponível para esta parcela.`);
      }
    }
    // Validação de Saldo
    else if (method === 'balance' && balance < loan.installmentValue) {
      return Alert.alert('Saldo Insuficiente', 'O valor da parcela é maior que seu saldo atual. Deseja usar o saldo mesmo assim e ficar negativo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar e Negativar', style: 'destructive', onPress: () => executePayment(loan, method, card) }
      ]);
    }

    executePayment(loan, method, card);
  };

  const executePayment = async (loan: Loan, method: 'balance' | 'credit_card', card?: any) => {
    if (!user?.uid) return;

    try {
      await addTransaction({
        type: 'expense',
        amount: loan.installmentValue,
        description: `Parcela - ${loan.name}`,
        category: 'Dívidas',
        icon: 'cash-outline',
        paymentMethod: method,
        creditCardId: card?.id,
        creditCardName: card?.name
      });
      
      await loanService.registerPayment(loan.id, user.uid);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sucesso', 'Parcela registrada e descontada com sucesso!');
      setPaymentModal(null);
      loadLoans();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível registrar o pagamento.');
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Empréstimos e Dívidas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {localLoans.length === 0 ? (
          <View style={s.emptyBox}>
             <Ionicons name="cash-outline" size={48} color="#D1D5DB" />
             <Text style={s.emptyText}>Você não possui dívidas cadastradas.</Text>
          </View>
        ) : (
          localLoans.map(l => {
            const paid = l.paidInstallments;
            const inst = l.installments;
            const pct = inst > 0 ? Math.round((paid / inst) * 100) : 0;
            const monthly = l.installmentValue;

            return (
              <View key={l.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={s.cardTotal}>{fmt(l.totalAmount)}</Text>
                </View>
                <Text style={s.cardProgress}>{paid} de {inst} parcelas pagas ({fmt(monthly)}/mês)</Text>
                <View style={s.progBg}>
                  <View style={[s.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: theme.accent }]} />
                </View>
                <TouchableOpacity style={[s.payBtn, { backgroundColor: theme.accentSoft }]} onPress={() => handlePayClick(l)} disabled={paid >= inst}>
                  <Text style={[s.payBtnTxt, { color: theme.accent }]}>Pagar Parcela</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Nova Dívida</Text>
            <TextInput style={s.input} placeholder="Descrição (ex: Carro)" value={newName} onChangeText={setNewName} />
            <TextInput style={s.input} placeholder="Valor Total (R$)" value={newTotal} onChangeText={setNewTotal} keyboardType="numeric" />
            <View style={s.row}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Qtd. Parcelas" value={newInstallments} onChangeText={setNewInstallments} keyboardType="numeric" />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Valor Parcela" value={newInstallmentValue} onChangeText={setNewInstallmentValue} keyboardType="numeric" />
            </View>
            <View style={s.row}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}><Text style={s.cancelBtnTxt}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleCreate}><Text style={s.saveBtnTxt}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Pagamento de Parcela */}
      <Modal visible={!!paymentModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Pagar Parcela</Text>
            <Text style={s.sheetDesc}>Escolha como deseja registrar o pagamento de {fmt(paymentModal?.installmentValue || 0)} para o empréstimo "{paymentModal?.name}".</Text>
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
              <TouchableOpacity style={s.payOptionBtn} onPress={() => processPayment(paymentModal!, 'balance')}>
                <Ionicons name="wallet-outline" size={20} color="#111827" />
                <View style={{ flex: 1 }}><Text style={s.payOptionTxt}>Saldo Atual</Text><Text style={s.payOptionSub}>Disponível: {fmt(balance)}</Text></View>
              </TouchableOpacity>
              
              {userCards.map((c: any) => (
                <TouchableOpacity key={c.id} style={[s.payOptionBtn, { borderColor: c.color || theme.accent }]} onPress={() => processPayment(paymentModal!, 'credit_card', c)}>
                  <Ionicons name="card-outline" size={20} color={c.color || theme.accent} />
                  <View style={{ flex: 1 }}><Text style={s.payOptionTxt}>Cartão {c.name}</Text><Text style={s.payOptionSub}>Limite: {fmt(Math.max((c.limit || 0) - (c.used || 0), 0))}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity style={s.cancelBtn} onPress={() => setPaymentModal(null)}><Text style={s.cancelBtnTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  content: { padding: 20, paddingBottom: 100 },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9CA3AF', marginTop: 12, fontSize: 14 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  cardTotal: { fontSize: 18, fontWeight: '800', color: '#EF4444' },
  cardProgress: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  progBg: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, marginBottom: 20, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 5 },
  payBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  payBtnTxt: { fontWeight: '800', fontSize: 14 },
  fab: { position: 'absolute', right: 24, bottom: 90, width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 24, color: '#111827', textAlign: 'center' },
  sheetDesc: { fontSize: 14, color: '#4B5563', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, fontSize: 16, marginBottom: 16, color: '#111827', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  payOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 12 },
  payOptionTxt: { fontSize: 15, fontWeight: '800', color: '#111827' },
  payOptionSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { color: '#475569', fontWeight: '700', fontSize: 16 },
  saveBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 }
});
