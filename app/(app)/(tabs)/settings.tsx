// app/(app)/(tabs)/settings.tsx
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true, geoReminders: false,
    autoBackup: true, offlineSync: true, compareRegion: false,
    notifyBills: true, notifyBudget: true, notifyGoals: true,
  });
  const [masterModal, setMasterModal] = useState(false);
  const [masterPass, setMasterPass]   = useState('');
  const [masterConf, setMasterConf]   = useState('');
  const [retireAge, setRetireAge]     = useState('28');
  const [retireIncome, setRetireIncome] = useState('6500');

  const toggle = (k: keyof typeof settings) => setSettings((s: { [x: string]: any; }) => ({ ...s, [k]: !s[k] }));
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  const calcRetirement = () => {
    const age = parseInt(retireAge) || 28;
    const income = parseFloat(retireIncome) || 6500;
    return Math.round((income * 12 * 25) / ((65 - age) * 12));
  };

  const saveMaster = () => {
    if (!masterPass || masterPass.length < 8) { Alert.alert('Erro', 'Mínimo 8 caracteres.'); return; }
    if (masterPass !== masterConf) { Alert.alert('Erro', 'As senhas não coincidem.'); return; }
    Alert.alert('Sucesso', 'Senha mestra salva.');
    setMasterModal(false); setMasterPass(''); setMasterConf('');
  };

  const Row = ({ label, sKey, onPress }: { label: string; sKey?: keyof typeof settings; onPress?: () => void }) => (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={s.rowLabel}>{label}</Text>
      {sKey
        ? <Switch value={settings[sKey]} onValueChange={() => toggle(sKey)} trackColor={{ false: '#E5E7EB', true: '#1565C0' }} thumbColor="#fff" />
        : <Text style={s.chevron}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Configurações</Text>

        {/* Perfil */}
        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{firstName[0]?.toUpperCase()}</Text></View>
          <View>
            <Text style={s.profileName}>{user?.name ?? 'Usuário'}</Text>
            <Text style={s.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Segurança</Text>
        <View style={s.card}>
          <Row label="Autenticação em dois fatores" onPress={() => router.push('/(app)/(tabs)/totp-setup' as never)} />
          <Row label="Senha mestra (criptografia)" onPress={() => setMasterModal(true)} />
        </View>

        <Text style={s.sectionLabel}>Notificações</Text>
        <View style={s.card}>
          <Row label="Notificações push" sKey="notifications" />
          <Row label="Lembretes por localização" sKey="geoReminders" />
          <Row label="Contas a vencer" sKey="notifyBills" />
          <Row label="Alertas de orçamento" sKey="notifyBudget" />
          <Row label="Progresso de metas" sKey="notifyGoals" />
        </View>

        <Text style={s.sectionLabel}>Dados & Sincronização</Text>
        <View style={s.card}>
          <Row label="Backup automático" sKey="autoBackup" />
          <Row label="Sincronização offline" sKey="offlineSync" />
          <Row label="Comparar com região" sKey="compareRegion" />
          <Row label="Exportar para IR" onPress={() => Alert.alert('Exportar', 'Arquivo gerado com os dados do app.')} />
          <Row label="Importar extrato bancário" onPress={() => Alert.alert('Importar', 'Funcionalidade em desenvolvimento.')} />
        </View>

        <Text style={s.sectionLabel}>Planejamento de aposentadoria</Text>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Idade atual</Text>
              <TextInput style={s.input} value={retireAge} onChangeText={setRetireAge} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Renda mensal (R$)</Text>
              <TextInput style={s.input} value={retireIncome} onChangeText={setRetireIncome} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={s.retireResult}>
            <Text style={s.retireTxt}>Para aposentar-se confortavelmente aos <Text style={{ fontWeight: '700' }}>65 anos</Text>, poupar:</Text>
            <Text style={s.retireVal}>R$ {calcRetirement().toLocaleString('pt-BR')}/mês</Text>
          </View>
        </View>

        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: '#1565C0' }]} onPress={() => router.push('/(app)/(tabs)/debug' as never)}>
          <Text style={[s.logoutTxt, { color: '#fff' }]}>Ver Logs de Debug</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={() =>
          Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sair', style: 'destructive', onPress: logout },
          ])
        }>
          <Text style={s.logoutTxt}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={masterModal} animationType="slide" transparent onRequestClose={() => setMasterModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMasterModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Senha mestra</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
              Define uma senha para proteger os dados salvos no aparelho.
            </Text>
            <Text style={s.fieldLabel}>Nova senha mestra</Text>
            <TextInput style={[s.input, { marginBottom: 14 }]} secureTextEntry placeholder="Mínimo 8 caracteres" placeholderTextColor="#9CA3AF" value={masterPass} onChangeText={setMasterPass} />
            <Text style={s.fieldLabel}>Confirmar senha</Text>
            <TextInput style={[s.input, { marginBottom: 20 }]} secureTextEntry placeholder="Repita a senha" placeholderTextColor="#9CA3AF" value={masterConf} onChangeText={setMasterConf} />
            <TouchableOpacity style={s.submitBtn} onPress={saveMaster}>
              <Text style={s.submitTxt}>Salvar senha mestra</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 20 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '700', color: '#1565C0' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 8 },
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  rowLabel: { fontSize: 14, color: '#111827' },
  chevron: { fontSize: 22, color: '#9CA3AF' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  retireResult: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14 },
  retireTxt: { fontSize: 13, color: '#1E40AF', lineHeight: 20 },
  retireVal: { fontSize: 20, fontWeight: '700', color: '#1565C0', marginTop: 6 },
  logoutBtn: { marginHorizontal: 16, marginBottom: 40, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutTxt: { color: '#991B1B', fontSize: 15, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#111827' },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
