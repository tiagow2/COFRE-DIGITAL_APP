import { useAuth } from '@/context/AuthContext';
import { useTOTP } from '@/hooks/useTOTP';

import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[dot.base, active && dot.active, done && dot.done]}>
      {done && <Text style={dot.check}>✓</Text>}
    </View>
  );
}

const dot = StyleSheet.create({
  base:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: '#1565C0' },
  done:   { backgroundColor: '#16A34A' },
  check:  { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default function TOTPSetupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { step, secret, otpUri, loading, error, totpEnabled, startSetup, confirmSetup, cancelSetup, disableTOTP, checkIfEnabled, clearError } = useTOTP();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (user?.uid) checkIfEnabled(user.uid);
  }, [checkIfEnabled, user]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim, step, isVerifying]);

  const handleStartSetup = () => {
    if (!user?.email) return;
    fadeAnim.setValue(0);
    setIsVerifying(false);
    startSetup(user.email);
  };

  const handleConfirm = async () => {
    if (!user?.uid) return;
    const ok = await confirmSetup(code, user.uid);
    if (ok) { setCode(''); setIsVerifying(false); }
  };

  const handleDisable = () => {
    if (!user?.uid) return;
    Alert.alert('Desativar 2FA', 'Sua conta ficará menos protegida. Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => disableTOTP(user!.uid) },
    ]);
  };

  // TOTP já ativo
  if (totpEnabled && step === 'idle') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
            <Text style={s.backTxt}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Autenticação em dois fatores</Text>
          <View style={s.statusCard}>
            <View style={s.statusBadge}>
              <View style={s.greenDot} />
              <Text style={s.statusText}>Ativo</Text>
            </View>
            <Text style={s.statusDesc}>Seu app está protegido com o Google Authenticator.{'\n'}A cada login você precisará digitar o código de 6 dígitos.</Text>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>Como funciona</Text>
            <Text style={s.infoItem}>🔄  Um novo código é gerado a cada 30 segundos</Text>
            <Text style={s.infoItem}>📱  Somente quem tem seu celular consegue entrar</Text>
            <Text style={s.infoItem}>🔐  Mesmo com a senha, sem o código não acessa</Text>
          </View>
          <TouchableOpacity style={s.dangerBtn} onPress={handleDisable} disabled={loading}>
            {loading ? <ActivityIndicator color="#991B1B" /> : <Text style={s.dangerTxt}>Desativar 2FA</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Concluído
  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={s.successIcon}>
            <Text style={{ fontSize: 42 }}>🔒</Text>
          </View>
          <Text style={s.successTitle}>2FA ativado!</Text>
          <Text style={s.successDesc}>Seu Cofre Digital agora está protegido. A partir do próximo login, o app pedirá o código do Google Authenticator.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()}>
            <Text style={s.primaryTxt}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // QR Code
  if (step === 'qrcode' && !isVerifying) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity style={s.backRow} onPress={cancelSetup}>
            <Text style={s.backTxt}>← Cancelar</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Configurar 2FA</Text>
          <View style={s.steps}>
            <StepDot active done /><View style={s.stepLine} />
            <StepDot active={false} done={false} /><View style={s.stepLine} />
            <StepDot active={false} done={false} />
          </View>
          <View style={s.stepsLabels}>
            <Text style={[s.stepLabel, { color: '#16A34A' }]}>Instalar</Text>
            <Text style={s.stepLabel}>Escanear</Text>
            <Text style={s.stepLabel}>Verificar</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 1 — Instale o app</Text>
            <Text style={s.cardDesc}>Baixe o <Text style={{ fontWeight: '700' }}>Google Authenticator</Text> na App Store ou Play Store antes de continuar.</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 2 — Escaneie o QR Code</Text>
            <Text style={s.cardDesc}>Abra o Google Authenticator, toque em + e escolha Escanear QR code.</Text>
            <View style={s.qrWrapper}>
              {otpUri ? <QRCode value={otpUri} size={180} color="#111827" backgroundColor="#fff" /> : <ActivityIndicator color="#1565C0" />}
            </View>
            <Text style={s.qrHint}>Mantenha este QR Code em segredo.</Text>
            {secret && (
              <View style={s.secretBox}>
                <Text style={s.secretLabel}>Ou configure manualmente:</Text>
                <Text style={s.secretText}>{secret}</Text>
                <TouchableOpacity style={s.copyBtn} onPress={async () => { Clipboard.setString(secret); Alert.alert('✅ Copiado', 'Chave copiada para a área de transferência.'); }}>
                  <Text style={s.copyBtnTxt}>Copiar chave</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.ghostBtn} onPress={cancelSetup}>
              <Text style={s.ghostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={() => { fadeAnim.setValue(0); setCode(''); clearError(); setIsVerifying(true); }}>
              <Text style={s.primaryTxt}>Já escaniei →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Verificação do código
  if (isVerifying && step === 'qrcode') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backRow} onPress={() => setIsVerifying(false)}>
            <Text style={s.backTxt}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Configurar 2FA</Text>
          <View style={s.steps}>
            <StepDot active done /><View style={s.stepLine} />
            <StepDot active done /><View style={s.stepLine} />
            <StepDot active={true} done={false} />
          </View>
          <View style={s.stepsLabels}>
            <Text style={[s.stepLabel, { color: '#16A34A' }]}>Instalar</Text>
            <Text style={[s.stepLabel, { color: '#16A34A' }]}>Escanear</Text>
            <Text style={[s.stepLabel, s.stepLabelActive]}>Verificar</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 3 — Confirme o código</Text>
            <Text style={s.cardDesc}>Digite o código de <Text style={{ fontWeight: '700' }}>6 dígitos</Text> que aparece agora no Google Authenticator.</Text>
            {error ? <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View> : null}
            <Text style={s.fieldLabel}>Código de verificação</Text>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); clearError(); }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              textAlign="center"
              autoFocus
              onSubmitEditing={handleConfirm}
            />
            <Text style={s.codeHint}>O código muda a cada 30 segundos.</Text>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.ghostBtn} onPress={() => setIsVerifying(false)}>
              <Text style={s.ghostTxt}>← Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1, opacity: code.length < 6 || loading ? 0.6 : 1 }]} onPress={handleConfirm} disabled={code.length < 6 || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Confirmar e ativar</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Idle — tela inicial
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Text style={s.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Autenticação em dois fatores</Text>
        <View style={s.heroCard}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔐</Text>
          <Text style={s.heroTitle}>Proteja seu cofre</Text>
          <Text style={s.heroDesc}>O 2FA adiciona uma camada extra de segurança. Além da senha, você precisará de um código temporário do Google Authenticator para entrar.</Text>
        </View>
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>O que você vai precisar</Text>
          <Text style={s.infoItem}>📱  Google Authenticator instalado</Text>
          <Text style={s.infoItem}>📷  Câmera para escanear o QR Code</Text>
          <Text style={s.infoItem}>⏱️  Cerca de 2 minutos</Text>
        </View>
        <TouchableOpacity style={s.primaryBtn} onPress={handleStartSetup}>
          <Text style={s.primaryTxt}>Ativar autenticação em dois fatores</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingBottom: 60 },
  backRow: { marginBottom: 16 },
  backTxt: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  steps:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepLine:    { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepsLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  stepLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', flex: 1 },
  stepLabelActive: { color: '#1565C0', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  cardDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  heroCard: { backgroundColor: '#EFF6FF', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#1E40AF', marginBottom: 8 },
  heroDesc:  { fontSize: 13, color: '#3B82F6', lineHeight: 20, textAlign: 'center' },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  infoTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoItem:  { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  statusCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A', marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  statusDesc: { fontSize: 13, color: '#166534', lineHeight: 20 },
  qrWrapper: { alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 12, marginVertical: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  qrHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic' },
  secretBox: { marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  secretLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 8 },
  secretText: { fontSize: 13, color: '#111827', fontWeight: '700', textAlign: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, letterSpacing: 1 },
  copyBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  copyBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  codeInput: { borderWidth: 2, borderColor: '#1565C0', borderRadius: 14, height: 64, fontSize: 28, fontWeight: '700', color: '#111827', backgroundColor: '#F0F7FF', letterSpacing: 10 },
  codeHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginVertical: 12 },
  errorTxt: { color: '#991B1B', fontSize: 13 },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: { backgroundColor: '#1565C0', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ghostBtn:   { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, height: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  ghostTxt:   { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  dangerBtn:  { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  dangerTxt:  { color: '#991B1B', fontSize: 15, fontWeight: '600' },
  successIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 12 },
  successDesc:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
