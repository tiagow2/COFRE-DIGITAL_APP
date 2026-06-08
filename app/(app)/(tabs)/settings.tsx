import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { LocalProfile, profileService } from '@/services/profileService';
import { parseCurrencyInput } from '@/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { exportService } from '@/services/exportService';
import { loanService } from '@/services/loanService';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { transactions, creditCards, goals } = useFinance();
  const theme = useFinancialTheme();
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [settings, setSettings] = useState({
    autoBackup: true, offlineSync: true,
  });
  const [masterModal, setMasterModal] = useState(false);
  const [masterPass, setMasterPass]   = useState('');
  const [masterConf, setMasterConf]   = useState('');
  const [retireAge, setRetireAge]     = useState('28');
  const [retireIncome, setRetireIncome] = useState('6500');
  const [irModal, setIrModal] = useState(false);
  const [irYear, setIrYear] = useState(new Date().getFullYear().toString());

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

  const userGoals = useMemo(() => {
    if (!user?.uid) return [];
    return goals.filter((g: any) => {
      const ownerId = g.userId ?? g.user_id;
      return !ownerId || ownerId === user.uid;
    });
  }, [goals, user?.uid]);

  const toggle = (k: keyof typeof settings) => {
    Haptics.selectionAsync();
    setSettings(s => ({ ...s, [k]: !s[k] }));
  };

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user?.uid) {
        setProfile(null);
        return () => { active = false; };
      }

      profileService.load(user.uid).then((nextProfile) => {
        if (active) setProfile(nextProfile);
      });

      return () => { active = false; };
    }, [user?.uid])
  );

  const calcRetirement = () => {
    const age    = Number.parseInt(retireAge, 10) || 28;
    const income = parseCurrencyInput(retireIncome) || 6500;
    const monthsLeft = Math.max((65 - age) * 12, 1);
    return Math.round((income * 12 * 25) / monthsLeft);
  };

  const saveMaster = () => {
    if (!masterPass || masterPass.length < 8) { Alert.alert('Erro', 'Mínimo 8 caracteres.'); return; }
    if (masterPass !== masterConf) { Alert.alert('Erro', 'As senhas não coincidem.'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ Sucesso', 'Senha mestra definida. Seus dados estão protegidos.');
    setMasterModal(false); setMasterPass(''); setMasterConf('');
  };

  const handleExportIR = async () => {
    if (!user?.uid) return;
    const loans = await loanService.listLoans(user.uid);
    await exportService.exportToIR({ user, transactions: userTransactions, loans, creditCards: userCards, goals: userGoals }, Number(irYear));
    setIrModal(false);
  };

  const Row = ({ label, icon, sKey, onPress, isDestructive = false, isLast = false }: {
    label: string; icon: string; sKey?: keyof typeof settings;
    onPress?: () => void; isDestructive?: boolean; isLast?: boolean;
  }) => (
    <TouchableOpacity style={[s.row, isLast && { borderBottomWidth: 0 }]}
      onPress={() => { if (onPress) onPress(); else if (sKey) toggle(sKey); }}
      activeOpacity={onPress || sKey ? 0.7 : 1}
    >
      <View style={s.rowLeft}>
        <View style={[s.rowIconBg, isDestructive && { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name={icon as any} size={20} color={isDestructive ? '#EF4444' : '#4B5563'} />
        </View>
        <Text style={[s.rowLabel, isDestructive && { color: '#EF4444' }]} numberOfLines={2}>{label}</Text>
      </View>
      {sKey
        ? <Switch value={settings[sKey]} onValueChange={() => toggle(sKey)} trackColor={{ false: '#E5E7EB', true: '#1565C0' }} thumbColor="#fff" />
        : <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Perfil & Configurações</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Perfil */}
        <View style={[s.profileCard, { borderColor: theme.border }]}>
          <View style={[s.avatar, { backgroundColor: theme.accentSoft }]}>
            {profile?.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={s.avatarImage} />
            ) : (
              <Text style={[s.avatarTxt, { color: theme.accent }]}>{firstName[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.profileName} numberOfLines={1}>{user?.name ?? 'Usuário'}</Text>
            <Text style={s.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
            {!!profile?.city && <Text style={s.profileMeta} numberOfLines={1}>{profile.city}</Text>}
          </View>
          <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.accentSoft }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(app)/(tabs)/profile-edit' as never); }}>
            <Text style={s.editBtnTxt}>Editar</Text>
          </TouchableOpacity>
        </View>

        {profile?.signature && (
          <View style={s.signaturePreviewCard}>
            <View style={s.signaturePreviewHeader}>
              <Ionicons name="create-outline" size={18} color={theme.accent} />
              <Text style={s.signaturePreviewTitle}>Assinatura digital salva</Text>
            </View>
            <Image source={{ uri: profile.signature }} style={s.signaturePreview} resizeMode="contain" />
          </View>
        )}

        <View style={s.sectionHeader}>
          <Ionicons name="lock-closed" size={16} color={theme.accent} />
          <Text style={s.sectionLabel}>Segurança</Text>
        </View>
        <View style={s.card}>
          <Row icon="shield-checkmark-outline" label="Autenticação em dois fatores (2FA)" onPress={() => router.push('/(app)/(tabs)/totp-setup' as never)} />
          <Row icon="key-outline" label="Senha mestra (backup criptografado)" onPress={() => setMasterModal(true)} isLast />
        </View>

        <View style={s.sectionHeader}>
          <Ionicons name="cloud-done" size={16} color={theme.accent} />
          <Text style={s.sectionLabel}>Dados & Sincronização</Text>
        </View>
        <View style={s.card}>
          <Row icon="cloud-upload-outline"  label="Backup automático" sKey="autoBackup" />
          <Row icon="cloud-offline-outline" label="Modo offline" sKey="offlineSync" />
          <Row icon="location-outline" label="Lembretes por localização" onPress={() => router.push('/(app)/(tabs)/geo-reminders' as never)} />
        <Row icon="document-text-outline" label="Exportar dados para IR" onPress={() => setIrModal(true)} isLast />
        </View>

        <View style={s.sectionHeader}>
          <Ionicons name="trending-up" size={16} color={theme.accent} />
          <Text style={s.sectionLabel}>Planejamento de aposentadoria</Text>
        </View>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20, paddingVertical: 4 }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={s.fieldLabel}>Idade atual</Text>
              <TextInput style={s.input} value={retireAge} onChangeText={setRetireAge} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={s.fieldLabel}>Renda mensal (R$)</Text>
              <TextInput style={s.input} value={retireIncome} onChangeText={setRetireIncome} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={s.retireResult}>
            <View style={s.retireIconBg}>
              <Ionicons name="trending-up" size={24} color="#059669" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.retireTxt}>Para se aposentar confortavelmente aos <Text style={{ fontWeight: '700', color: '#111827' }}>65 anos</Text>, poupe:</Text>
              <Text style={s.retireVal} numberOfLines={1} adjustsFontSizeToFit>R$ {calcRetirement().toLocaleString('pt-BR')}/mês</Text>
            </View>
          </View>
        </View>

        <View style={s.card}>
          <Row icon="log-out-outline" label="Sair da conta" isDestructive onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: logout },
            ]);
          }} isLast />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

      <Modal visible={masterModal} animationType="slide" transparent onRequestClose={() => setMasterModal(false)}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Senha Mestra</Text>
            <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 20, lineHeight: 20, textAlign: 'center' }}>
              Define uma senha para criptografar os dados salvos localmente no dispositivo.
            </Text>
            <Text style={s.fieldLabel}>Nova senha mestra</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Mínimo 8 caracteres" placeholderTextColor="#9CA3AF" value={masterPass} onChangeText={setMasterPass} />
            <Text style={s.fieldLabel}>Confirmar senha</Text>
            <TextInput style={[s.input, { marginBottom: 24 }]} secureTextEntry placeholder="Repita a senha" placeholderTextColor="#9CA3AF" value={masterConf} onChangeText={setMasterConf} />
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={saveMaster}>
              <Text style={s.submitTxt}>Salvar Senha Mestra</Text>
            </TouchableOpacity>
          </TouchableOpacity>
      </KeyboardAvoidingView>
      </Modal>

    <Modal visible={irModal} animationType="slide" transparent onRequestClose={() => setIrModal(false)}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Exportar para IR</Text>
          <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>Gera um arquivo JSON estruturado contendo simulações de rendimentos, despesas, dívidas pagas e contribuições de metas para o ano escolhido.</Text>
          <Text style={s.fieldLabel}>Ano Base</Text>
          <TextInput style={[s.input, { marginBottom: 24 }]} keyboardType="numeric" maxLength={4} value={irYear} onChangeText={setIrYear} />
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleExportIR}>
            <Text style={s.submitTxt}>Gerar Relatório</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: 'transparent', marginTop: 8 }]} onPress={() => setIrModal(false)}><Text style={[s.submitTxt, { color: '#6B7280' }]}>Cancelar</Text></TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 28, borderWidth: 1, borderColor: '#F3F4F6' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: 22, fontWeight: '700', color: '#1565C0' },
  profileName: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 0 },
  profileEmail: { fontSize: 13, color: '#6B7280', marginTop: 2, minWidth: 0 },
  profileMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2, minWidth: 0 },
  editBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, flexShrink: 0 },
  editBtnTxt: { fontSize: 13, fontWeight: '600', color: '#111827' },
  signaturePreviewCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', marginTop: -14, marginBottom: 24 },
  signaturePreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  signaturePreviewTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  signaturePreview: { height: 72, width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 10, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#4B5563', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3, marginBottom: 24, borderWidth: 1, borderColor: '#F8FAFC' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowIconBg: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, minWidth: 0 },
  retireResult: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginBottom: 8 },
  retireIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  retireTxt: { fontSize: 13, color: '#374151', lineHeight: 19, minWidth: 0 },
  retireVal: { fontSize: 18, fontWeight: '700', color: '#059669', marginTop: 4, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12, color: '#111827', textAlign: 'center' },
  submitBtn: { backgroundColor: '#111827', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
});
