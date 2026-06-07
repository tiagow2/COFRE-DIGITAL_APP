import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const { goals, addGoal, depositToGoal, budgets, addBudget, getBudgetStatus } = useFinance();
  const router = useRouter();
  const theme = useFinancialTheme();
  const [tab, setTab] = useState<'metas' | 'orcamento'>('metas');

  const [modalGoal, setModalGoal]       = useState(false);
  const [modalDeposit, setModalDeposit] = useState<any>(null);
  const [modalBudget, setModalBudget]   = useState(false);

  const [gName, setGName]       = useState('');
  const [gTarget, setGTarget]   = useState('');
  const [gMonthly, setGMonthly] = useState('');
  const [gIcon, setGIcon]       = useState(GOAL_ICONS[7]);
  const [depAmt, setDepAmt]     = useState('');

  const [bCategory, setBCategory] = useState('');
  const [bLimit, setBLimit]       = useState('');
  const [bPeriod, setBPeriod]     = useState('monthly');

  const handleAddGoal = async () => {
    if (!gName.trim()) { Alert.alert('Erro', 'Informe o nome da meta.'); return; }
    const t = parseCurrencyInput(gTarget);
    const monthly = parseCurrencyInput(gMonthly);
    if (!Number.isFinite(t) || t <= 0) { Alert.alert('Erro', 'Informe o valor da meta.'); return; }
    try {
      await addGoal({ name: gName.trim(), target: t, monthly: Number.isFinite(monthly) ? monthly : 0, icon: gIcon.icon, color: gIcon.color });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalGoal(false); setGName(''); setGTarget(''); setGMonthly(''); setGIcon(GOAL_ICONS[7]);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível criar a meta.');
    }
  };

  const handleDeposit = async () => {
    const a = parseCurrencyInput(depAmt);
    if (!Number.isFinite(a) || a <= 0) { Alert.alert('Erro', 'Valor inválido.'); return; }
    try {
      await depositToGoal(modalDeposit.id, a);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalDeposit(null); setDepAmt('');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível depositar na meta.');
    }
  };

  const handleAddBudget = async () => {
    if (!bCategory.trim()) { Alert.alert('Erro', 'Informe a categoria.'); return; }
    const l = parseCurrencyInput(bLimit);
    if (!Number.isFinite(l) || l <= 0) { Alert.alert('Erro', 'Informe o limite.'); return; }
    try {
      await addBudget({ category: bCategory.trim(), limit: l, period: bPeriod, color: theme.accent });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalBudget(false); setBCategory(''); setBLimit('');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível criar o orçamento.');
    }
  };

  const monthsLeft = (g: any) => {
    if (!g.monthly) return '—';
    const rem = g.target - g.current;
    if (rem <= 0) return '✅ Concluída!';
    return `~${Math.ceil(rem / g.monthly)} meses`;
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(['metas', 'orcamento'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t === 'metas' ? 'Metas' : 'Orçamentos'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}>
        {/* ─── ABA METAS ─── */}
        {tab === 'metas' && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Minhas metas</Text>
              <TouchableOpacity style={s.addBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModalGoal(true); }}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnTxt}>Nova</Text>
              </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconBg}><Ionicons name="flag" size={32} color="#9CA3AF" /></View>
                <Text style={s.emptyTitle}>Nenhuma meta ainda</Text>
                <Text style={s.emptyDesc}>Crie sua primeira meta e comece a poupar com propósito!</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setModalGoal(true)}>
                  <Text style={s.emptyBtnTxt}>Criar primeira meta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map((g: any) => {
                const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
                const barColor = pct >= 80 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#3B82F6';
                const iconInfo = GOAL_ICONS.find(i => i.icon === g.icon) || GOAL_ICONS[7];
                return (
                  <TouchableOpacity key={g.id} style={s.goalCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModalDeposit(g); }} activeOpacity={0.85}>
                    <View style={s.goalHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <View style={[s.goalIconBg, { backgroundColor: iconInfo.bg }]}>
                          <Ionicons name={g.icon as any || 'flag-outline'} size={18} color={iconInfo.color} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.goalName} numberOfLines={1}>{g.name}</Text>
                          <Text style={s.goalSub} numberOfLines={1}>{monthsLeft(g)}</Text>
                        </View>
                      </View>
                      <View style={[s.badge, { backgroundColor: pct >= 80 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#DBEAFE' }]}>
                        <Text style={[s.badgeTxt, { color: pct >= 80 ? '#059669' : pct >= 40 ? '#B45309' : '#1D4ED8' }]}>{pct}%</Text>
                      </View>
                    </View>
                    <View style={s.progBg}><View style={[s.progFill, { width: `${pct}%`, backgroundColor: barColor }]} /></View>
                    <View style={s.goalFooter}>
                      <Text style={s.goalDetail} numberOfLines={1} adjustsFontSizeToFit>{fmt(g.current)} de {fmt(g.target)}</Text>
                      <View style={s.depositHint}>
                        <Ionicons name="add-circle-outline" size={14} color="#1565C0" />
                        <Text style={s.depositHintTxt}>Depositar</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ─── ABA ORÇAMENTOS ─── */}
        {tab === 'orcamento' && (
          <>
          {/* Acesso à divisão de gastos em grupo (RF14) */}
          <TouchableOpacity style={{
            marginHorizontal: 20, marginTop: 16, marginBottom: 4,
            backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderWidth: 1, borderColor: '#BFDBFE'
          }} onPress={() => router.push('/(app)/(tabs)/split-expenses' as never)}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people-outline" size={20} color="#1565C0" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E40AF' }}>Divisão de gastos em grupo</Text>
              <Text style={{ fontSize: 12, color: '#60A5FA', marginTop: 2 }}>Divida contas com amigos e família</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
          </>
        )}
      {tab === 'orcamento' && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Orçamentos</Text>
              <TouchableOpacity style={s.addBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModalBudget(true); }}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnTxt}>Novo</Text>
              </TouchableOpacity>
            </View>

            {budgets.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconBg}><Ionicons name="pie-chart" size={32} color="#9CA3AF" /></View>
                <Text style={s.emptyTitle}>Nenhum orçamento</Text>
                <Text style={s.emptyDesc}>Crie orçamentos por categoria para controlar seus gastos mensais.</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setModalBudget(true)}>
                  <Text style={s.emptyBtnTxt}>Criar orçamento</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgets.map((b: any) => {
                const { spent, pct, remaining } = getBudgetStatus(b);
                const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';
                return (
                  <View key={b.id} style={s.budgetCard}>
                    <View style={s.budgetHeader}>
                      <Text style={s.budgetName} numberOfLines={1}>{b.category}</Text>
                      <View style={[s.badge, { backgroundColor: pct >= 90 ? '#FEE2E2' : pct >= 70 ? '#FEF3C7' : '#D1FAE5' }]}>
                        <Text style={[s.badgeTxt, { color: barColor }]}>{pct}%</Text>
                      </View>
                    </View>
                    <View style={s.progBg}><View style={[s.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} /></View>
                    <View style={s.budgetFooter}>
                      <Text style={s.goalDetail} numberOfLines={1} adjustsFontSizeToFit>{fmt(spent)} de {fmt(b.limit)}</Text>
                      {pct >= 90
                        ? <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>⚠️ Limite quase atingido</Text>
                        : <Text style={s.goalDetail} numberOfLines={1} adjustsFontSizeToFit>{fmt(remaining)} restantes</Text>}
                    </View>
                    <Text style={s.periodTxt}>{b.period === 'monthly' ? 'Mensal' : b.period === 'weekly' ? 'Semanal' : 'Trimestral'}</Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: Nova meta */}
      <Modal visible={modalGoal} animationType="slide" transparent onRequestClose={() => setModalGoal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalGoal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Nova meta</Text>
            <Text style={s.fieldLabel}>Nome da meta</Text>
            <TextInput style={s.modalInput} placeholder="Ex: Viagem, Carro, Reserva..." placeholderTextColor="#9CA3AF" value={gName} onChangeText={setGName} />
            <Text style={s.fieldLabel}>Valor total (R$)</Text>
            <TextInput style={s.modalInput} placeholder="0,00" placeholderTextColor="#9CA3AF" value={gTarget} onChangeText={setGTarget} keyboardType="numeric" />
            <Text style={s.fieldLabel}>Depósito mensal (R$)</Text>
            <TextInput style={[s.modalInput, { marginBottom: 16 }]} placeholder="0,00" placeholderTextColor="#9CA3AF" value={gMonthly} onChangeText={setGMonthly} keyboardType="numeric" />
            <Text style={s.fieldLabel}>Ícone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {GOAL_ICONS.map(i => (
                <TouchableOpacity key={i.name} style={[s.iconChip, gIcon.name === i.name && s.iconChipActive]} onPress={() => setGIcon(i)}>
                  <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: i.bg }]}>
                    <Ionicons name={i.icon as any} size={16} color={i.color} />
                  </View>
                  <Text style={s.iconChipTxt}>{i.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.submitBtn} onPress={handleAddGoal}>
              <Text style={s.submitTxt}>Criar meta</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Depositar */}
      <Modal visible={!!modalDeposit} animationType="slide" transparent onRequestClose={() => setModalDeposit(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalDeposit(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Depositar na meta</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12 }}>
              <Ionicons name="flag-outline" size={16} color="#6B7280" />
              <Text style={{ color: '#374151', fontWeight: '600', flex: 1, minWidth: 0 }} numberOfLines={1}>{modalDeposit?.name}</Text>
            </View>
            {modalDeposit && (
              <View style={{ marginBottom: 16 }}>
                <View style={s.progBg}><View style={[s.progFill, { width: `${Math.min(Math.round((modalDeposit.current / modalDeposit.target) * 100), 100)}%`, backgroundColor: '#10B981' }]} /></View>
                <Text style={[s.goalDetail, { marginTop: 6 }]}>{fmt(modalDeposit.current)} de {fmt(modalDeposit.target)}</Text>
              </View>
            )}
            <Text style={s.fieldLabel}>Valor do depósito (R$)</Text>
            <TextInput style={[s.modalInput, { marginBottom: 24 }]} placeholder="0,00" placeholderTextColor="#9CA3AF" value={depAmt} onChangeText={setDepAmt} keyboardType="numeric" autoFocus />
            <TouchableOpacity style={s.submitBtn} onPress={handleDeposit}>
              <Text style={s.submitTxt}>Confirmar Depósito</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Novo orçamento */}
      <Modal visible={modalBudget} animationType="slide" transparent onRequestClose={() => setModalBudget(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalBudget(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Novo orçamento</Text>
            <Text style={s.fieldLabel}>Categoria</Text>
            <TextInput style={s.modalInput} placeholder="Ex: Alimentação, Transporte..." placeholderTextColor="#9CA3AF" value={bCategory} onChangeText={setBCategory} />
            <Text style={s.fieldLabel}>Limite (R$)</Text>
            <TextInput style={s.modalInput} placeholder="0,00" placeholderTextColor="#9CA3AF" value={bLimit} onChangeText={setBLimit} keyboardType="numeric" />
            <Text style={s.fieldLabel}>Período</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {[{ label: 'Semanal', val: 'weekly' }, { label: 'Mensal', val: 'monthly' }, { label: 'Trimestral', val: 'quarterly' }].map(p => (
                <TouchableOpacity key={p.val} style={[s.periodBtn, bPeriod === p.val && s.periodBtnActive]} onPress={() => setBPeriod(p.val)}>
                  <Text style={[s.periodBtnTxt, bPeriod === p.val && s.periodBtnTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.submitBtn} onPress={handleAddBudget}>
              <Text style={s.submitTxt}>Criar orçamento</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabTxt: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  tabTxtActive: { color: '#111827', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1565C0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexShrink: 0 },
  addBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  goalCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  goalIconBg: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalName: { fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 0 },
  goalSub: { fontSize: 12, color: '#6B7280', marginTop: 2, minWidth: 0 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexShrink: 0 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  progBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 },
  goalDetail: { fontSize: 12, color: '#6B7280', fontWeight: '500', flexShrink: 1, minWidth: 0 },
  depositHint: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  depositHintTxt: { fontSize: 12, color: '#1565C0', fontWeight: '600' },
  budgetCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  budgetName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  periodTxt: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 40, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  emptyIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyDesc: { color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1565C0', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  emptyBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111827', textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  submitBtn: { backgroundColor: '#111827', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  iconChip: { alignItems: 'center', gap: 4, marginRight: 12, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#fff' },
  iconChipActive: { borderColor: '#1565C0', backgroundColor: '#EFF6FF' },
  iconChipTxt: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  periodBtn: { flex: 1, minWidth: 0, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  periodBtnActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  periodBtnTxt: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  periodBtnTxtActive: { color: '#fff', fontWeight: '700' },
});
