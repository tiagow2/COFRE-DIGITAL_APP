// app/(auth)/register.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

type Fields = { name?: string; email?: string; password?: string; confirm?: string };

export default function RegisterScreen() {
  const { register, authError, clearError } = useAuth();

  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState<Fields>({});

  const validate = () => {
    const e: Fields = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Nome deve ter pelo menos 2 caracteres.';
    if (!email.trim()) e.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido.';
    if (!password) e.password = 'Informe uma senha.';
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres.';
    if (!confirm) e.confirm = 'Confirme a senha.';
    else if (confirm !== password) e.confirm = 'As senhas não coincidem.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const strength = (() => {
    if (!password) return { label: '', color: '#E5E7EB', pct: 0 };
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s <= 1) return { label: 'Fraca', color: '#EF4444', pct: 20 };
    if (s <= 2) return { label: 'Razoável', color: '#F59E0B', pct: 50 };
    if (s <= 3) return { label: 'Boa', color: '#1D9E75', pct: 75 };
    return { label: 'Forte', color: '#0F6E56', pct: 100 };
  })();

  const handleRegister = async () => {
    if (!validate()) return;
    clearError();
    setLoading(true);
    await register(name.trim(), email.trim(), password);
    setLoading(false);
  };

  const setField = (field: keyof Fields, val: string) => {
    if (field === 'name') setName(val);
    if (field === 'email') setEmail(val);
    if (field === 'password') setPassword(val);
    if (field === 'confirm') setConfirm(val);
    setErrors(e => ({ ...e, [field]: undefined }));
    clearError();
  };

  return (
    <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.gradient}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>CD</Text>
          </View>
          <Text style={styles.appName}>Criar conta</Text>
          <Text style={styles.tagline}>Comece a controlar suas finanças hoje</Text>

          <View style={styles.card}>
            {authError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{authError}</Text>
              </View>
            ) : null}

            {/* Nome */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nome completo</Text>
              <View style={[styles.inputRow, errors.name ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>N</Text>
                <TextInput style={styles.input} placeholder="Ex: João da Silva" placeholderTextColor="#9CA3AF" value={name} onChangeText={v => setField('name', v)} autoCapitalize="words" />
              </View>
              {errors.name ? <Text style={styles.fieldErr}>{errors.name}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={[styles.inputRow, errors.email ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>E</Text>
                <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor="#9CA3AF" value={email} onChangeText={v => setField('email', v)} keyboardType="email-address" autoCapitalize="none" />
              </View>
              {errors.email ? <Text style={styles.fieldErr}>{errors.email}</Text> : null}
            </View>

            {/* Senha */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={[styles.inputRow, errors.password ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>S</Text>
                <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" placeholderTextColor="#9CA3AF" value={password} onChangeText={v => setField('password', v)} secureTextEntry={!showPass} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: '600' }}>{showPass ? 'Ocultar' : 'Mostrar'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.fieldErr}>{errors.password}</Text> : null}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBg}>
                    <View style={[styles.strengthFill, { width: `${strength.pct}%`, backgroundColor: strength.color }]} />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            {/* Confirmar */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmar senha</Text>
              <View style={[styles.inputRow, errors.confirm ? styles.inputErr : null]}>
                <Text style={styles.inputIcon}>C</Text>
                <TextInput style={styles.input} placeholder="Repita a senha" placeholderTextColor="#9CA3AF" value={confirm} onChangeText={v => setField('confirm', v)} secureTextEntry={!showConf} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowConf(!showConf)}>
                  <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: '600' }}>{showConf ? 'Ocultar' : 'Mostrar'}</Text>
                </TouchableOpacity>
              </View>
              {errors.confirm ? <Text style={styles.fieldErr}>{errors.confirm}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Criar conta</Text>}
            </TouchableOpacity>

            <Text style={styles.terms}>
              Ao criar conta, você concorda com os{' '}
              <Text style={{ color: '#1565C0' }}>Termos de Uso</Text>.
            </Text>

            <View style={styles.footerRow}>
              <Text style={styles.footerTxt}>Já tem conta?  </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.footerLink}>Entrar</Text></TouchableOpacity>
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

  logoWrap: { width: 70, height: 70, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  logoEmoji: { fontSize: 28, fontWeight: '700', color: '#fff' },
  appName: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 24, marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },

  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBoxText: { color: '#991B1B', fontSize: 13 },

  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, height: 52, backgroundColor: '#F9FAFB', gap: 8 },
  inputErr: { borderColor: '#EF4444' },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  fieldErr: { color: '#EF4444', fontSize: 12, marginTop: 4 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBg: { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 55 },

  btn: { backgroundColor: '#1565C0', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  terms: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 12, lineHeight: 18 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerTxt: { color: '#6B7280', fontSize: 14 },
  footerLink: { color: '#1565C0', fontSize: 14, fontWeight: '600' },
});
