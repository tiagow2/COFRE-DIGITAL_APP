// app/(app)/(tabs)/totp-setup.tsx
import { useAuth } from '@/context/AuthContext';
import { useTOTP } from '@/hooks/useTOTP';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated, Clipboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// ─── Componente de step indicator ─────────────────────────────────────────────
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[
      dot.base,
      active && dot.active,
      done && dot.done,
    ]}>
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

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function TOTPSetupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    step, secret, otpUri, loading, error,
    totpEnabled, startSetup, confirmSetup,
    cancelSetup, disableTOTP, checkIfEnabled, clearError,
  } = useTOTP();

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false); // FIX: Screen transition control
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user?.uid) {
      checkIfEnabled(user.uid);
    }
  }, [user]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
  }, [step, isVerifying]);

  const handleStartSetup = () => {
    if (!user?.email) return;
    fadeAnim.setValue(0);
    setIsVerifying(false); // Garante que começa no QR Code
    startSetup(user.email);
  };

  const handleConfirm = async () => {
    if (!user?.uid) return;
    const ok = await confirmSetup(code, user.uid);
    if (ok) {
      setCode('');
      setIsVerifying(false);
    }
  };

  const handleDisable = () => {
    if (!user?.uid) return;
    Alert.alert(
      'Desativar autenticação em dois fatores',
      'Sua conta ficará menos protegida. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desativar', style: 'destructive', onPress: () => disableTOTP(user!.uid) },
      ],
    );
  };

  // ─── Estado: TOTP já ativo ─────────────────────────────────────────────────
  if (totpEnabled && step === 'idle') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.pageTitle}>Autenticação em dois fatores</Text>

          <View style={s.statusCard}>
            <View style={s.statusBadge}>
              <Text style={s.statusDot}>●</Text>
              <Text style={s.statusText}>Ativo</Text>
            </View>
            <Text style={s.statusDesc}>
              Seu app está protegido com o Google Authenticator.{'\n'}
              A cada login, você precisará digitar o código de 6 dígitos.
            </Text>
          </View>

          <View style={s.infoCard}>
            <Text style={s.infoTitle}>Como funciona</Text>
            <Text style={s.infoItem}>Lock  A new code is generated every 30 seconds</Text>
            <Text style={s.infoItem}>Mobile  Only the person with your phone can enter</Text>
            <Text style={s.infoItem}>Block  Even with the password, without the code you cannot access</Text>
          </View>

          <TouchableOpacity style={s.dangerBtn} onPress={handleDisable} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#991B1B" />
              : <Text style={s.dangerTxt}>Desativar 2FA</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado: concluído ─────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.scroll, { opacity: fadeAnim, flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
          <View style={s.successIcon}>
            <Text style={{ fontSize: 42 }}>Lock</Text>
          </View>
          <Text style={s.successTitle}>2FA ativado!</Text>
          <Text style={s.successDesc}>
            Seu Cofre Digital agora está protegido com autenticação em dois fatores.
            A partir do próximo login, o app pedirá o código do Google Authenticator.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()}>
            <Text style={s.primaryTxt}>Entendido</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─── Estado: exibir QR Code ────────────────────────────────────────────────
  // FIX: Only show QR Code if isVerifying is false
  if (step === 'qrcode' && !isVerifying) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.pageTitle}>Configurar 2FA</Text>

          {/* Steps */}
          <View style={s.steps}>
            <StepDot active done />
            <View style={s.stepLine} />
            <StepDot active={false} done={false} />
            <View style={s.stepLine} />
            <StepDot active={false} done={false} />
          </View>
          <View style={s.stepsLabels}>
            <Text style={[s.stepLabel, s.stepLabelActive]}>Instalar</Text>
            <Text style={s.stepLabel}>Escanear</Text>
            <Text style={s.stepLabel}>Verificar</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 1 — Instale o app</Text>
            <Text style={s.cardDesc}>
              Baixe o <Text style={{ fontWeight: '700' }}>Google Authenticator</Text> na App Store ou Play Store antes de continuar.
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 2 — Escaneie o QR Code</Text>
            <Text style={s.cardDesc}>Abra o Google Authenticator → toque em "+" → "Escanear QR code"</Text>
            <View style={s.qrWrapper}>
              {otpUri ? (
                <QRCode
                  value={otpUri}
                  size={180}
                  color="#111827"
                  backgroundColor="#fff"
                />
              ) : (
                <ActivityIndicator color="#1565C0" />
              )}
            </View>
            <Text style={s.qrHint}>Mantenha este QR Code em segredo.</Text>

            {/* CHAVE DE CONFIGURAÇÃO */}
            {secret && (
              <View style={s.secretBox}>
                <Text style={s.secretLabel}>Ou configure manualmente:</Text>
                <Text style={s.secretText}>{secret}</Text>
                <TouchableOpacity
                  style={s.copyBtn}
                  onPress={() => {
                    Clipboard.setString(secret);
                    Alert.alert('OK Copied', 'Key copied to clipboard.');
                  }}
                >
                  <Text style={s.copyBtnTxt}>Copy key</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.ghostBtn} onPress={cancelSetup}>
              <Text style={s.ghostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1 }]}
              onPress={() => { 
                fadeAnim.setValue(0); 
                setCode(''); 
                clearError(); 
                setIsVerifying(true); // FIX: Transform the screen!
              }} 
            >
              <Text style={s.primaryTxt}>Já escaniei →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado: verificar código ──────────────────────────────────────────────
  // Estado 'verify' - exibir tela de verificação do código
  if (step === 'verify') {
    // step === 'verify'
  }

  // ─── Estado idle ou tela de verificação ─────────────────────────────────────
  return <VerifyStep
    code={code}
    setCode={setCode}
    loading={loading}
    error={error}
    onConfirm={handleConfirm}
    onBack={() => {
      if (step === 'qrcode') {
        setIsVerifying(false); // Volta para o QR Code
      } else {
        cancelSetup();
      }
    }}
    onStartSetup={handleStartSetup}
    step={step}
    clearError={clearError}
    isVerifying={isVerifying}
  />;
}

// ─── Sub-componente: tela de verificação / entrada ────────────────────────────
function VerifyStep({
  code, setCode, loading, error,
  onConfirm, onBack, onStartSetup, step, clearError, isVerifying,
}: any) {
  
  if (step === 'idle') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.pageTitle}>Autenticação em dois fatores</Text>

          <View style={s.heroCard}>
            <Text style={s.heroIcon}>S</Text>
            <Text style={s.heroTitle}>Proteja seu cofre</Text>
            <Text style={s.heroDesc}>
              O 2FA adiciona uma camada extra de segurança. Além da senha, você precisará de um código temporário do Google Authenticator para entrar.
            </Text>
          </View>

          <View style={s.infoCard}>
            <Text style={s.infoTitle}>O que você vai precisar</Text>
            <Text style={s.infoItem}>Mobile  Google Authenticator app installed</Text>
            <Text style={s.infoItem}>Camera  Camera to scan the QR Code</Text>
            <Text style={s.infoItem}>Clock  About 2 minutes</Text>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={onStartSetup}>
            <Text style={s.primaryTxt}>Ativar autenticação em dois fatores</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // showVerifyStep === true → mostrar tela de verificação do código
  if (isVerifying) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.pageTitle}>Configurar 2FA</Text>

          {/* Steps */}
          <View style={s.steps}>
            <StepDot active done />
            <View style={s.stepLine} />
            <StepDot active done />
            <View style={s.stepLine} />
            <StepDot active={true} done={false} />
          </View>
          <View style={s.stepsLabels}>
            <Text style={[s.stepLabel, { color: '#16A34A' }]}>Instalar</Text>
            <Text style={[s.stepLabel, { color: '#16A34A' }]}>Escanear</Text>
            <Text style={[s.stepLabel, s.stepLabelActive]}>Verificar</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Passo 3 — Confirme o código</Text>
            <Text style={s.cardDesc}>
              Digite o código de <Text style={{ fontWeight: '700' }}>6 dígitos</Text> que aparece agora no Google Authenticator para confirmar que tudo está funcionando.
            </Text>

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            ) : null}

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
              onSubmitEditing={onConfirm}
            />
            <Text style={s.codeHint}>O código muda a cada 30 segundos.</Text>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.ghostBtn} onPress={onBack}>
              <Text style={s.ghostTxt}>← Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1, opacity: code.length < 6 || loading ? 0.6 : 1 }]}
              onPress={onConfirm}
              disabled={code.length < 6 || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryTxt}>Confirmar e ativar</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Fallback: renderiza tela vazia (não deve chegar aqui normalmente)
  return null;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 16, paddingBottom: 40 },

  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20, marginTop: 4 },

  // Steps
  steps:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepLine:     { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepsLabels:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  stepLabel:    { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', flex: 1 },
  stepLabelActive: { color: '#1565C0', fontWeight: '700' },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  cardDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 4 },

  // Hero card
  heroCard: {
    backgroundColor: '#EFF6FF', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  heroIcon:  { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#1E40AF', marginBottom: 8 },
  heroDesc:  { fontSize: 13, color: '#3B82F6', lineHeight: 20, textAlign: 'center' },

  // Info card
  infoCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 20,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoItem:  { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },

  // Status card (quando ativo)
  statusCard: {
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusDot:   { color: '#16A34A', fontSize: 14, marginRight: 6 },
  statusText:  { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  statusDesc:  { fontSize: 13, color: '#166534', lineHeight: 20 },

  // QR code
  qrWrapper: { alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 12, marginVertical: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  qrHint:    { fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic' },

  // Chave de configuração
  secretBox: { marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  secretLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 8 },
  secretText: { fontSize: 13, color: '#111827', fontFamily: 'monospace', fontWeight: '700', textAlign: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, letterSpacing: 1 },
  copyBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  copyBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Código input
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, marginTop: 8 },
  codeInput:  {
    borderWidth: 2, borderColor: '#1565C0', borderRadius: 14,
    height: 64, fontSize: 28, fontWeight: '700', color: '#111827',
    backgroundColor: '#F0F7FF', letterSpacing: 10,
  },
  codeHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

  // Erro
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginVertical: 12 },
  errorTxt: { color: '#991B1B', fontSize: 13 },

  // Botões
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    backgroundColor: '#1565C0', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ghostBtn:  { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, height: 52, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  ghostTxt:  { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  dangerBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  dangerTxt: { color: '#991B1B', fontSize: 15, fontWeight: '600' },

  // Success
  successIcon:  { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 12 },
  successDesc:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
