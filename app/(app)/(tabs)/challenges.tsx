import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';
import { LinearGradient } from 'expo-linear-gradient';

export default function ChallengesScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  const { challenges, addChallenge, updateChallengeProgress, getBalance } = useFinance();

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');

  const handleCreate = async () => {
    if (!newTitle.trim()) return Alert.alert('Erro', 'Insira o título do desafio.');
    const target = parseCurrencyInput(newTarget);
    if (!Number.isFinite(target) || target <= 0) return Alert.alert('Erro', 'Insira um valor válido.');

    try {
      await addChallenge({
        title: newTitle.trim(),
        targetAmount: target,
        deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
        medalIcon: 'medal-outline'
      });

      setModalVisible(false);
      setNewTitle('');
      setNewTarget('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível criar o desafio.');
    }
  };

  const handleContribute = async () => {
    if (!selectedChallengeId) return;
    const amount = parseCurrencyInput(contribAmount);
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert('Erro', 'Valor inválido.');
    
    if (amount > getBalance()) {
       return Alert.alert('Saldo Insuficiente', 'Você não tem saldo suficiente para esta contribuição.');
    }

    try {
      await updateChallengeProgress(selectedChallengeId, amount);
      setContribModalVisible(false);
      setContribAmount('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível atualizar o desafio.');
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <SafeAreaView style={s.safe}>
      
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Desafios Gamificados</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.statsCard}>
          <View style={s.medalWrap}>
            <Ionicons name="trophy" size={32} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.statsTitle}>Suas Conquistas</Text>
            <Text style={s.statsDesc}>
              Complete desafios para ganhar medalhas virtuais e melhorar suas economias.
            </Text>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Ativos</Text>
        </View>

        {challenges.filter(c => c.status === 'active').length === 0 && (
          <Text style={s.empty}>Nenhum desafio ativo. Crie um novo!</Text>
        )}

        {challenges.filter(c => c.status === 'active').map(c => {
          const pct = Math.min((c.currentAmount / c.targetAmount) * 100, 100);
          return (
            <View key={c.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle} numberOfLines={1} ellipsizeMode="tail">{c.title}</Text>
                <Ionicons name="flag-outline" size={20} color="#6366F1" />
              </View>
              <Text style={s.cardProgress}>{fmt(c.currentAmount)} de {fmt(c.targetAmount)}</Text>
              <View style={s.progBg}>
                <View style={[s.progFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
              </View>
              <TouchableOpacity 
                style={[s.contribBtn, { backgroundColor: theme.accentSoft }]} 
                onPress={() => {
                  setSelectedChallengeId(c.id);
                  setContribModalVisible(true);
                }}
              >
                <Text style={[s.contribBtnTxt, { color: theme.accent }]}>Contribuir</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Completados 🏅</Text>
        </View>

        {challenges.filter(c => c.status === 'completed').length === 0 && (
          <Text style={s.empty}>Você ainda não completou nenhum desafio.</Text>
        )}

        {challenges.filter(c => c.status === 'completed').map(c => (
          <LinearGradient key={c.id} colors={['#FDE68A', '#F59E0B']} start={{x:0, y:0}} end={{x:1, y:1}} style={s.medalCard}>
            <View style={s.medalIconWrap}>
              <Text style={{ fontSize: 36 }}>🏅</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.medalCardTitle} numberOfLines={1} ellipsizeMode="tail">{c.title}</Text>
              <Text style={s.medalCardProgress}>Conquista Desbloqueada!</Text>
            </View>
            <Ionicons name="sparkles" size={28} color="#FFFBEB" style={{ opacity: 0.7 }} />
          </LinearGradient>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal Criar Desafio */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Novo Desafio</Text>
            
            <Text style={s.label}>O que você quer alcançar?</Text>
            <TextInput style={s.input} placeholder="Ex: Economizar no café" value={newTitle} onChangeText={setNewTitle} />

            <Text style={s.label}>Qual o valor alvo (R$)?</Text>
            <TextInput style={s.input} placeholder="150" value={newTarget} onChangeText={setNewTarget} keyboardType="numeric" />

            <View style={s.row}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleCreate}>
                <Text style={s.saveBtnTxt}>Criar Desafio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Contribuir */}
      <Modal visible={contribModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView style={s.overlayCenter} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheetCenter}>
            <Text style={s.sheetTitle}>Contribuir</Text>
            <Text style={s.label}>Valor (R$)</Text>
            <TextInput style={s.input} placeholder="50" value={contribAmount} onChangeText={setContribAmount} keyboardType="numeric" />

            <View style={s.row}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => {setContribModalVisible(false); setContribAmount('');}}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleContribute}>
                <Text style={s.saveBtnTxt}>Confirmar</Text>
              </TouchableOpacity>
            </View>
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
  title: { fontSize: 16, fontWeight: '700', color: '#111827', flexShrink: 1, minWidth: 0 },
  content: { padding: 20, paddingBottom: 140 },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 28, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  medalWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  statsTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  statsDesc: { fontSize: 12, color: '#B45309', marginTop: 4, lineHeight: 16, flexShrink: 1, minWidth: 0 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  empty: { color: '#6B7280', fontSize: 14, fontStyle: 'italic', marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, overflow: 'hidden', minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1, minWidth: 0 },
  cardProgress: { fontSize: 13, color: '#6B7280', marginBottom: 16, flexShrink: 1, minWidth: 0 },
  progBg: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, marginBottom: 20 },
  progFill: { height: '100%', borderRadius: 5 },
  medalCard: { flexDirection: 'row', alignItems: 'center', padding: 24, borderRadius: 28, marginBottom: 16, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  medalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  medalCardTitle: { fontSize: 17, fontWeight: '800', color: '#78350F', marginBottom: 4 },
  medalCardProgress: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  contribBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#EEF2FF', borderRadius: 12 },
  contribBtnTxt: { color: '#4F46E5', fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', right: 24, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'center', padding: 20 },
  sheetCenter: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111827', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F9FAFB', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnTxt: { color: '#4B5563', fontWeight: '600', fontSize: 16 },
  saveBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#111827', alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 16 }
});
