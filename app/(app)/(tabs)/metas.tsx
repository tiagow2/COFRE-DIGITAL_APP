import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const GOAL_ICONS = [
  { name: 'Viagem', icon: 'airplane-outline', color: '#1D9E75', bg: '#D1FAE5' },
  { name: 'Casa', icon: 'home-outline', color: '#2563EB', bg: '#DBEAFE' },
  { name: 'Carro', icon: 'car-outline', color: '#D97706', bg: '#FEF3C7' },
  { name: 'Educação', icon: 'school-outline', color: '#7C3AED', bg: '#EDE9FE' },
  { name: 'Saúde', icon: 'medical-outline', color: '#059669', bg: '#DCFCE7' },
  { name: 'Reserva', icon: 'shield-outline', color: '#1565C0', bg: '#DBEAFE' },
  { name: 'Tech', icon: 'laptop-outline', color: '#D85A30', bg: '#FEE2E2' },
  { name: 'Outros', icon: 'flag-outline', color: '#4B5563', bg: '#F3F4F6' },
];

export default function GoalsScreen() {
  const { goals, addGoal, depositToGoal, getBalance, creditCards, addTransaction } = useFinance();
  const theme = useFinancialTheme();
  const [modalGoal, setModalGoal] = useState(false);
  const [modalDeposit, setModalDeposit] = useState<any>(null);

  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gMonthly, setGMonthly] = useState('');
  const [gIcon, setGIcon] = useState(GOAL_ICONS[7]);
  const [depAmt, setDepAmt] = useState('');
  const [payMethod, setPayMethod] = useState<'balance' | 'credit_card'>('balance');
  const [selCard, setSelCard] = useState('');

  const resetGoalForm = () => {
    setGName('');
    setGTarget('');
    setGMonthly('');
    setGIcon(GOAL_ICONS[7]);
  };

  const handleAddGoal = async () => {
    if (!gName.trim()) {
      Alert.alert('Erro', 'Informe o nome da meta.');
      return;
    }

    const target = parseCurrencyInput(gTarget);
    const monthly = parseCurrencyInput(gMonthly);

    if (!Number.isFinite(target) || target <= 0) {
      Alert.alert('Erro', 'Informe o valor da meta.');
      return;
    }

    try {
      await addGoal({
        name: gName.trim(),
        target,
        monthly: Number.isFinite(monthly) ? monthly : 0,
        icon: gIcon.icon,
        color: gIcon.color,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalGoal(false);
      resetGoalForm();
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível criar a meta.');
    }
  };

  const handleDeposit = async () => {
    const amount = parseCurrencyInput(depAmt);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Alert.alert('Erro', 'Informe um valor válido.');
    }

    const remaining = modalDeposit.target - modalDeposit.current;
    if (amount > remaining) {
      Alert.alert('Atenção', `Essa contribuição (${fmt(amount)}) ultrapassa o valor necessário para concluir a meta (${fmt(remaining)}). Deseja continuar mesmo assim?`, [
        { text: 'Revisar Valor', style: 'cancel' },
        { text: 'Continuar', onPress: () => executeDeposit(amount) }
      ]);
      return;
    }

    executeDeposit(amount);
  };

  const executeDeposit = async (amount: number) => {
    // Validar Meio de Pagamento
    let cardInfo: any = null;
    if (payMethod === 'credit_card') {
      cardInfo = creditCards.find(c => c.id === selCard);
      if (!cardInfo) return Alert.alert('Erro', 'Cartão não selecionado.');
      const available = (cardInfo.limit || 0) - (cardInfo.used || 0);
      if (amount > available) return Alert.alert('Limite Insuficiente', 'O cartão selecionado não tem limite para esta contribuição.');
    } else {
      if (getBalance() < amount) {
        return Alert.alert('Saldo Insuficiente', 'Essa contribuição deixará seu saldo negativo. Deseja continuar?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', style: 'destructive', onPress: () => finalizeDeposit(amount, cardInfo) }
        ]);
      }
    }

    finalizeDeposit(amount, cardInfo);
  };

  const finalizeDeposit = async (amount: number, cardInfo: any) => {
    try {
      // Gerar Transação Real no Extrato
      await addTransaction({
        type: 'expense',
        description: `Contribuição para meta - ${modalDeposit.name}`,
        amount: amount,
        category: 'Metas',
        icon: modalDeposit.icon || 'flag-outline',
        paymentMethod: payMethod,
        creditCardId: payMethod === 'credit_card' ? cardInfo?.id : undefined,
        creditCardName: payMethod === 'credit_card' ? cardInfo?.name : undefined,
      });

      // Subir o Progresso da Meta
      await depositToGoal(modalDeposit.id, amount);
      
      if (modalDeposit.current + amount >= modalDeposit.target) {
        Alert.alert('Parabéns! 🏆', `Você acabou de alcançar sua meta: ${modalDeposit.name}!`);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalDeposit(null);
      setDepAmt('');
      setPayMethod('balance');
      setSelCard('');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível depositar na meta.');
    }
  };

  const monthsLeft = (goal: any) => {
    if (!goal.monthly) return 'Sem depósito mensal definido';
    const remaining = goal.target - goal.current;
    if (remaining <= 0) return 'Concluída';
    return `~${Math.ceil(remaining / goal.monthly)} meses restantes`;
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>Metas financeiras</Text>
            <Text style={s.subtitle} numberOfLines={2}>
              Acompanhe objetivos, depósitos e quanto falta para chegar lá.
            </Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setModalGoal(true);
            }}
          >
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={s.addBtnTxt}>Nova</Text>
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconBg}>
              <Ionicons name="flag-outline" size={34} color="#9CA3AF" />
            </View>
            <Text style={s.emptyTitle}>Nenhuma meta ainda</Text>
            <Text style={s.emptyDesc}>Crie sua primeira meta e acompanhe o progresso com clareza.</Text>
            <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setModalGoal(true)}>
              <Text style={s.emptyBtnTxt}>Criar primeira meta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((goal: any) => {
            const target = Number(goal.target) || 1;
            const current = Number(goal.current) || 0;
            const pct = Math.min(Math.round((current / target) * 100), 100);
            const barColor = pct >= 80 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#3B82F6';
            const iconInfo = GOAL_ICONS.find((item) => item.icon === goal.icon) || GOAL_ICONS[7];

            return (
              <TouchableOpacity
                key={goal.id}
                style={s.goalCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalDeposit(goal);
                }}
                activeOpacity={0.85}
              >
                <View style={s.goalHeader}>
                  <View style={s.goalTitleBlock}>
                    <View style={[s.goalIconBg, { backgroundColor: iconInfo.bg }]}>
                      <Ionicons name={(goal.icon || 'flag-outline') as any} size={18} color={iconInfo.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.goalName} numberOfLines={1}>{goal.name}</Text>
                      <Text style={s.goalSub} numberOfLines={1}>{monthsLeft(goal)}</Text>
                    </View>
                  </View>
                  <View style={[s.badge, { backgroundColor: pct >= 80 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#DBEAFE' }]}>
                    <Text style={[s.badgeTxt, { color: pct >= 80 ? '#059669' : pct >= 40 ? '#B45309' : '#1D4ED8' }]}>
                      {pct}%
                    </Text>
                  </View>
                </View>

                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                </View>

                <View style={s.goalFooter}>
                  <Text style={s.goalDetail} numberOfLines={1} adjustsFontSizeToFit>
                    {fmt(current)} de {fmt(target)}
                  </Text>
                  <View style={s.depositHint}>
                    <Ionicons name="add-circle-outline" size={14} color={theme.accent} />
                    <Text style={[s.depositHintTxt, { color: theme.accent }]}>Depositar</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalGoal} animationType="slide" transparent onRequestClose={() => setModalGoal(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Nova meta</Text>

            <Text style={s.fieldLabel}>Nome da meta</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Viagem, carro, reserva..."
              placeholderTextColor="#9CA3AF"
              value={gName}
              onChangeText={setGName}
            />

            <Text style={s.fieldLabel}>Valor total (R$)</Text>
            <TextInput
              style={s.input}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              value={gTarget}
              onChangeText={setGTarget}
              keyboardType="numeric"
            />

            <Text style={s.fieldLabel}>Depósito mensal (R$)</Text>
            <TextInput
              style={s.input}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              value={gMonthly}
              onChangeText={setGMonthly}
              keyboardType="numeric"
            />

            <Text style={s.fieldLabel}>Ícone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
              {GOAL_ICONS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[s.iconChip, gIcon.name === item.name && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                  onPress={() => setGIcon(item)}
                >
                  <View style={[s.iconChipIcon, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  <Text style={s.iconChipTxt}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleAddGoal}>
              <Text style={s.submitTxt}>Criar meta</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!modalDeposit} animationType="slide" transparent onRequestClose={() => setModalDeposit(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Depositar na meta</Text>

            <View style={s.depositSummary}>
              <Ionicons name="flag-outline" size={16} color="#6B7280" />
              <Text style={s.depositSummaryText} numberOfLines={1}>{modalDeposit?.name}</Text>
            </View>

            {modalDeposit && (
              <View style={{ marginBottom: 16 }}>
                <View style={s.progressBg}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${Math.min(Math.round((modalDeposit.current / modalDeposit.target) * 100), 100)}%`,
                        backgroundColor: '#10B981',
                      },
                    ]}
                  />
                </View>
                <Text style={[s.goalDetail, { marginTop: 6 }]}>
                  {fmt(modalDeposit.current)} de {fmt(modalDeposit.target)}
                </Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Valor do depósito (R$)</Text>
            <TextInput
              style={[s.input, { marginBottom: 16 }]}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              value={depAmt}
              onChangeText={setDepAmt}
              keyboardType="numeric"
              autoFocus
            />

            <Text style={s.fieldLabel}>Retirar dinheiro de</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <TouchableOpacity style={[s.payOptionBtn, payMethod === 'balance' && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]} onPress={() => setPayMethod('balance')}>
                <Ionicons name="wallet-outline" size={18} color={payMethod === 'balance' ? theme.accent : '#6B7280'} />
                <Text style={[s.payOptionTxt, payMethod === 'balance' && { color: theme.accent }]}>Saldo Atual</Text>
              </TouchableOpacity>
              {creditCards.map(c => (
                <TouchableOpacity key={c.id} style={[s.payOptionBtn, payMethod === 'credit_card' && selCard === c.id && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]} onPress={() => { setPayMethod('credit_card'); setSelCard(c.id); }}>
                  <Ionicons name="card-outline" size={18} color={payMethod === 'credit_card' && selCard === c.id ? theme.accent : '#6B7280'} />
                  <Text style={[s.payOptionTxt, payMethod === 'credit_card' && selCard === c.id && { color: theme.accent }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleDeposit}>
              <Text style={s.submitTxt}>Confirmar depósito</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 120, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', minWidth: 0 },
  subtitle: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: 3 },
  addBtn: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 21, flexShrink: 0 },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  goalCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  goalTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  goalIconBg: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalName: { fontSize: 15, fontWeight: '800', color: '#111827', minWidth: 0 },
  goalSub: { fontSize: 12, color: '#6B7280', marginTop: 2, minWidth: 0 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexShrink: 0 },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  progressBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 },
  goalDetail: { fontSize: 12, color: '#6B7280', fontWeight: '600', flexShrink: 1, minWidth: 0 },
  depositHint: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  depositHintTxt: { fontSize: 12, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 42, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  emptyIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 8 },
  emptyDesc: { color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 24, color: '#111827', textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 20 },
  submitBtn: { borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  iconChip: { alignItems: 'center', gap: 4, marginRight: 12, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#fff' },
  iconChipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconChipTxt: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  payOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', marginRight: 12 },
  payOptionTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  depositSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12 },
  depositSummaryText: { color: '#374151', fontWeight: '800', flex: 1, minWidth: 0 },
});
