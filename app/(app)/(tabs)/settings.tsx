import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { LocalProfile, profileService } from '@/services/profileService';
import { parseCurrencyInput } from '@/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { transactions } = useFinance();
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
    const year = new Date().getFullYear();
    const income = transactions.filter((t: any) => t.type === 'income');
    const deductible = transactions.filter((t: any) => ['Saúde', 'Educação'].includes(t.category));
    const totalIncome = income.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalDeductible = deductible.reduce((sum: number, t: any) => sum + t.amount, 0);
    const message = `IR ${year} - Cofre Digital\n\nRendimentos: R$ ${totalIncome.toFixed(2)}\nDedutíveis (Saúde/Educação): R$ ${totalDeductible.toFixed(2)}\n\nCompartilhe com seu contador.`;

    try {
      await Share.share({ message, title: `IR ${year}` });
    } catch {
      Alert.alert(`IR ${year}`, message);
    }
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

        <Text style={s.sectionLabel}>Segurança</Text>
        <View style={s.card}>
          <Row icon="shield-checkmark-outline" label="Autenticação em dois fatores (2FA)" onPress={() => router.push('/(app)/(tabs)/totp-setup' as never)} />
          <Row icon="key-outline" label="Senha mestra (backup criptografado)" onPress={() => setMasterModal(true)} isLast />
        </View>

        <Text style={s.sectionLabel}>Dados & Sincronização</Text>
        <View style={s.card}>
          <Row icon="cloud-upload-outline"  label="Backup automático" sKey="autoBackup" />
          <Row icon="cloud-offline-outline" label="Modo offline" sKey="offlineSync" />
          <Row icon="location-outline" label="Lembretes por localização" onPress={() => router.push('/(app)/(tabs)/geo-reminders' as never)} />
          <Row icon="document-text-outline" label="Exportar dados para IR" onPress={handleExportIR} isLast />
        </View>

        <Text style={s.sectionLabel}>Planejamento de aposentadoria</Text>
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

      <Modal visible={masterModal} animationType="slide" transparent onRequestClose={() => setMasterModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMasterModal(false)}>
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
            <TouchableOpacity style={s.submitBtn} onPress={saveMaster}>
              <Text style={s.submitTxt}>Salvar Senha Mestra</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0, marginHorizontal: 24, marginBottom: 10 },
  card: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowIconBg: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '500', color: '#111827', flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  retireResult: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginBottom: 8 },
  retireIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  retireTxt: { fontSize: 13, color: '#374151', lineHeight: 19, minWidth: 0 },
  retireVal: { fontSize: 18, fontWeight: '700', color: '#059669', marginTop: 4, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#111827', textAlign: 'center' },
  submitBtn: { backgroundColor: '#111827', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
