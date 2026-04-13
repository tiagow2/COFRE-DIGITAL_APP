// app/(app)/(tabs)/metas.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, TextInput, Alert } from 'react-native';
import { useFinance } from '@/context/FinanceContext';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CHALLENGES = [
  { id: '1', title: 'Semana sem delivery',          desc: 'Economize R$ 100 esta semana', status: 'active' },
  { id: '2', title: 'Mês sem compras supérfluas',   desc: '3 de 30 dias completados',    status: 'progress' },
  { id: '3', title: 'Guardar R$ 1.000 em março',    desc: 'Finalizado',                  status: 'done' },
];

export default function GoalsScreen() {
  const { goals, addGoal, depositToGoal } = useFinance();
  const [modalGoal, setModalGoal]         = useState(false);
  const [modalDeposit, setModalDeposit]   = useState<typeof goals[0] | null>(null);
  const [simVal, setSimVal]               = useState('10000');
  const [simMonths, setSimMonths]         = useState('24');
  const [gName, setGName]                 = useState('');
  const [gTarget, setGTarget]             = useState('');
  const [gMonthly, setGMonthly]           = useState('');
  const [depAmt, setDepAmt]               = useState('');

  const sim = (() => {
    const v = parseFloat(simVal) || 10000;
    const m = parseInt(simMonths) || 24;
    return {
      poup: Math.round(v * Math.pow(1.00583, m)),
      cdb:  Math.round(v * Math.pow(1.01, m)),
      td:   Math.round(v * Math.pow(1.00822, m)),
    };
  })();

  const handleAddGoal = () => {
    if (!gName.trim()) { Alert.alert('Erro', 'Informe o nome.'); return; }
    const t = parseFloat(gTarget);
    if (!t || t <= 0) { Alert.alert('Erro', 'Informe o valor da meta.'); return; }
    addGoal({ name: gName, target: t, monthly: parseFloat(gMonthly) || 0, icon: 'M', color: '#1565C0' });
    setModalGoal(false); setGName(''); setGTarget(''); setGMonthly('');
  };

  const handleDeposit = () => {
    const a = parseFloat(depAmt);
    if (!a || a <= 0) { Alert.alert('Erro', 'Valor inválido.'); return; }
    depositToGoal(modalDeposit!.id, a);
    setModalDeposit(null); setDepAmt('');
  };

  const monthsLeft = (g: typeof goals[0]) => {
    if (!g.monthly) return '—';
    const rem = g.target - g.current;
    if (rem <= 0) return 'Concluída!';
    return `~${Math.ceil(rem / g.monthly)} meses`;
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Metas & Economias</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalGoal(true)}>
            <Text style={s.addBtnTxt}>+ Nova</Text>
          </TouchableOpacity>
        </View>

        {goals.map((g: { current: number; target: number; id: React.Key | null | undefined; name: any; }) => {
          const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
          const barColor = pct >= 80 ? '#059669' : pct >= 40 ? '#F59E0B' : '#EF4444';
          return (
            <TouchableOpacity key={g.id} style={s.goalCard} onPress={() => setModalDeposit(g)} activeOpacity={0.85}>
              <View style={s.goalHeader}>
                <Text style={s.goalName}>{g.name}</Text>
                <View style={[s.badge, { backgroundColor: pct >= 80 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#FEE2E2' }]}>
                  <Text style={[s.badgeTxt, { color: pct >= 80 ? '#065F46' : pct >= 40 ? '#92400E' : '#991B1B' }]}>{pct}%</Text>
                </View>
              </View>
              <View style={s.progBg}><View style={[s.progFill, { width: `${pct}%`, backgroundColor: barColor }]} /></View>
              <View style={s.goalFooter}>
                <Text style={s.goalDetail}>{fmt(g.current)} / {fmt(g.target)}</Text>
                <Text style={s.goalDetail}>Conclusão: {monthsLeft(g)}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#1565C0', marginTop: 6, fontWeight: '500' }}>Toque para depositar</Text>
            </TouchableOpacity>
          );
        })}

        {goals.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40, fontWeight: '700', color: '#1565C0' }}>M</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 12 }}>Nenhuma meta ainda.</Text>
            <Text style={{ color: '#9CA3AF', marginTop: 4 }}>Crie sua primeira meta financeira!</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Desafios</Text>
        {CHALLENGES.map(c => (
          <View key={c.id} style={[s.challengeCard, c.status === 'done' && { opacity: 0.55 }]}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#1565C0' }}>D</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.challengeTitle}>{c.title}</Text>
              <Text style={s.challengeDesc}>{c.desc}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: c.status === 'progress' ? '#FEF3C7' : '#D1FAE5' }]}>
              <Text style={[s.badgeTxt, { color: c.status === 'progress' ? '#92400E' : '#065F46' }]}>
                {c.status === 'active' ? 'Ativo' : c.status === 'progress' ? 'Em andamento' : 'Concluído'}
              </Text>
            </View>
          </View>
        ))}

        <Text style={s.sectionTitle}>Simulador de investimentos</Text>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Valor inicial (R$)</Text>
              <TextInput style={s.simInput} value={simVal} onChangeText={setSimVal} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Prazo (meses)</Text>
              <TextInput style={s.simInput} value={simMonths} onChangeText={setSimMonths} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Poupança\n7% a.a.', val: sim.poup, color: '#059669' },
              { label: 'CDB\n12% a.a.',    val: sim.cdb,  color: '#1565C0' },
              { label: 'Tesouro\n10% a.a.',val: sim.td,   color: '#7C3AED' },
            ].map(it => (
              <View key={it.label} style={s.simCard}>
                <Text style={s.simLabel}>{it.label}</Text>
                <Text style={[s.simVal, { color: it.color }]}>{fmt(it.val)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal: Nova meta */}
      <Modal visible={modalGoal} animationType="slide" transparent onRequestClose={() => setModalGoal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalGoal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Nova meta</Text>
            {[
              { label: 'Nome da meta', val: gName, set: setGName, placeholder: 'Ex: Viagem, Carro...', kb: 'default' as const },
              { label: 'Valor total (R$)', val: gTarget, set: setGTarget, placeholder: '0,00', kb: 'numeric' as const },
              { label: 'Depósito mensal (R$)', val: gMonthly, set: setGMonthly, placeholder: '0,00', kb: 'numeric' as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.modalInput} placeholder={f.placeholder} placeholderTextColor="#9CA3AF" value={f.val} onChangeText={f.set} keyboardType={f.kb} />
              </View>
            ))}
            <TouchableOpacity style={s.submitBtn} onPress={handleAddGoal}><Text style={s.submitTxt}>Criar meta</Text></TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Depositar */}
      <Modal visible={!!modalDeposit} animationType="slide" transparent onRequestClose={() => setModalDeposit(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalDeposit(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Depositar na meta</Text>
            <Text style={{ color: '#6B7280', marginBottom: 16 }}>{modalDeposit?.name}</Text>
            <Text style={s.fieldLabel}>Valor (R$)</Text>
            <TextInput style={s.modalInput} placeholder="0,00" placeholderTextColor="#9CA3AF" value={depAmt} onChangeText={setDepAmt} keyboardType="numeric" />
            <TouchableOpacity style={s.submitBtn} onPress={handleDeposit}><Text style={s.submitTxt}>Confirmar</Text></TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  addBtn: { backgroundColor: '#1565C0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  goalCard: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 12 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8, color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 12, fontWeight: '600' },
  progBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  goalDetail: { fontSize: 12, color: '#9CA3AF' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  challengeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 8 },
  challengeTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  challengeDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  simInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  simCard: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10, alignItems: 'center' },
  simLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  simVal: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, color: '#111827' },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
