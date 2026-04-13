// app/(auth)/login.tsx
// Versão atualizada com suporte a TOTP (segundo fator)
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { login, resetPassword, authError, clearError, totpRequired, confirmTOTP, cancelTOTPLogin } = useAuth();

  // ── Campos de email/senha ──
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({});

  // ── Campo TOTP ──
  const [totpCode, setTotpCode]     = useState('');
  const [totpError, setTotpError]   = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  // ── Animação de transição ──
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (totpRequired) {
      Animated.spring(slideAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 60, friction: 10,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [totpRequired]);

  // ── Validação do formulário principal ──
  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido.';
    if (!password) e.password = 'Informe sua senha.';
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Login (1ª etapa) ──
  const handleLogin = async () => {
    if (!validate()) return;
    clearError();
    setLoading(true);
    await login(email.trim(), password);
    setLoading(false);
  };

  // ── Confirmação TOTP (2ª etapa) ──
  const handleTOTPConfirm = async () => {
    if (totpCode.length !== 6) return;
    setTotpLoading(true);
    setTotpError(null);
    const result = await confirmTOTP(totpCode);
    if (!result.success) {
      setTotpError(result.error ?? 'Código inválido.');
      setTotpCode('');
    }
    setTotpLoading(false);
  };

  const handleForgot = () => {
    if (!email.trim()) { Alert.alert('Esqueci minha senha', 'Digite seu e-mail no campo acima.'); return; }
    Alert.alert('Redefinir senha', `Enviar link para ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar', onPress: async () => {
        const r = await resetPassword(email.trim());
        Alert.alert(r.success ? 'E-mail enviado!' : 'Erro', r.success ? 'Verifique sua caixa de entrada.' : r.error);
      }},
    ]);
  };

  const setField = (field: 'email' | 'password', val: string) => {
    if (field === 'email') setEmail(val);
    else setPassword(val);
    setErrors((e: any) => ({ ...e, [field]: undefined }));
    clearError();
  };

  // ────────────────────────────────────────────────────────────────────────────
  // TELA 2: Verificação TOTP
  // ────────────────────────────────────────────────────────────────────────────
  if (totpRequired) {
    return (
      <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.gradient}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <View style={styles.logoWrap}>
              <Text style={styles.logoEmoji}>🔐</Text>
            </View>
            <Text style={styles.appName}>Verificação em dois fatores</Text>
            <Text style={styles.tagline}>Abra o Google Authenticator e insira o código</Text>

            <Animated.View style={[
              styles.card,
              { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }], opacity: slideAnim }
            ]}>
              <Text style={styles.cardTitle}>Código de verificação</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                Digite o código de <Text style={{ fontWeight: '700' }}>6 dígitos</Text> do app{' '}
                <Text style={{ fontWeight: '700' }}>Google Authenticator</Text>.
                O código muda a cada 30 segundos.
              </Text>

              {totpError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{totpError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Código de 6 dígitos</Text>
              <TextInput
                style={styles.codeInput}
                value={totpCode}
                onChangeText={v => { setTotpCode(v.replace(/\D/g, '').slice(0, 6)); setTotpError(null); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                textAlign="center"
                autoFocus
                onSubmitEditing={handleTOTPConfirm}
              />

              <TouchableOpacity
                style={[styles.btn, (totpCode.length < 6 || totpLoading) && { opacity: 0.6 }]}
                onPress={handleTOTPConfirm}
                disabled={totpCode.length < 6 || totpLoading}
                activeOpacity={0.85}
              >
                {totpLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Verificar e entrar</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelRow} onPress={cancelTOTPLogin}>
                <Text style={styles.cancelTxt}>← Voltar para o login</Text>
              </TouchableOpacity>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TELA 1: Login normal (email + senha)
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.gradient}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>CD</Text>
          </View>
          <Text style={styles.appName}>Cofre Digital</Text>
          <Text style={styles.tagline}>Controle suas finanças com segurança</Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar na conta</Text>

            {authError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{authError}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={[styles.inputRow, errors.email ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>E</Text>
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={v => setField('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              {errors.email ? <Text style={styles.fieldErr}>{errors.email}</Text> : null}
            </View>

            {/* Senha */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Senha</Text>
                <TouchableOpacity onPress={handleForgot}>
                  <Text style={styles.forgot}>Esqueci minha senha</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputRow, errors.password ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>S</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={v => setField('password', v)}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: '600' }}>
                    {showPass ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.fieldErr}>{errors.password}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Entrar</Text>}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerTxt}>Não tem conta?  </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity><Text style={styles.footerLink}>Criar conta</Text></TouchableOpacity>
              </Link>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  logoEmoji: { fontSize: 28, fontWeight: '700', color: '#fff' },
  appName:  { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  tagline:  { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 32, marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 20 },

  errorBox:     { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBoxText: { color: '#991B1B', fontSize: 13 },

  fieldGroup: { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  forgot:     { fontSize: 13, color: '#1565C0', fontWeight: '500' },

  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, height: 52, backgroundColor: '#F9FAFB', gap: 8 },
  inputErr: { borderColor: '#EF4444' },
  inputIcon: { fontSize: 16 },
  input:    { flex: 1, fontSize: 15, color: '#111827' },
  fieldErr: { color: '#EF4444', fontSize: 12, marginTop: 4 },

  btn:     { backgroundColor: '#1565C0', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  footerRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerTxt:  { color: '#6B7280', fontSize: 14 },
  footerLink: { color: '#1565C0', fontSize: 14, fontWeight: '600' },

  // TOTP
  codeInput: {
    borderWidth: 2, borderColor: '#1565C0', borderRadius: 14,
    height: 68, fontSize: 32, fontWeight: '700', color: '#111827',
    backgroundColor: '#F0F7FF', letterSpacing: 12, marginBottom: 20,
  },
  cancelRow: { alignItems: 'center', marginTop: 20 },
  cancelTxt: { color: '#6B7280', fontSize: 14 },
});
