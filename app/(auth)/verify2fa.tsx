// app/(auth)/verify2fa.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Verify2FAScreen() {
  // Agora estamos puxando as funções REAIS do seu AuthContext
  const { confirmTOTP, cancelTOTPLogin } = useAuth(); 
  const router = useRouter();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTimeLeft(seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleVerify = async () => {
    if (code.length < 6) { 
      setError('Digite os 6 dígitos do código.'); 
      return; 
    }
    
    setError('');
    setLoading(true);

    try {
      // CHAMA A VALIDAÇÃO REAL DO SEU BACKEND/TOTP
      const result = await confirmTOTP(code);
      
      if (result.success) {
        router.replace('/(app)/(tabs)'); 
      } else {
        // Se o código estiver errado, mostra o erro do seu AuthContext
        setError(result.error || 'Código incorreto.');
        setCode('');
      }
    } catch (err: any) {
      setError('Erro inesperado ao validar o código.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancelar login', 'Deseja voltar para a tela de login?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', onPress: () => { 
          cancelTOTPLogin(); // Limpa o usuário pendente no context
          router.replace('/(auth)/login'); 
        } 
      },
    ]);
  };

  const timerColor = timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#10B981';

  return (
    <LinearGradient colors={['#1565C0', '#1976D2', '#42A5F5']} style={s.gradient}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.container}>

          <View style={s.iconWrap}>
            <Text style={{ fontSize: 44 }}>🔐</Text>
          </View>
          <Text style={s.title}>Verificação em 2 etapas</Text>
          <Text style={s.subtitle}>
            Digite o código de 6 dígitos gerado pelo seu Google Authenticator.
          </Text>

          <View style={s.card}>
            <View style={s.timerRow}>
              <Text style={s.timerLabel}>Código expira em</Text>
              <Text style={[s.timerValue, { color: timerColor }]}>{timeLeft}s</Text>
            </View>
            <View style={s.timerBar}>
              <View style={[s.timerFill, {
                width: `${(timeLeft / 30) * 100}%`,
                backgroundColor: timerColor,
              }]} />
            </View>

            <Text style={s.label}>Código de Verificação</Text>
            <TextInput
              ref={inputRef}
              style={[s.codeInput, error ? s.codeInputErr : null]}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              value={code}
              onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />
            {error ? <Text style={s.errorTxt}>⚠️ {error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, (loading || code.length < 6) && s.btnDisabled]}
              onPress={handleVerify}
              disabled={loading || code.length < 6}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnTxt}>Verificar código</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCancel}>
              <Text style={s.cancelLink}>← Voltar ao login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  iconWrap: { width: 84, height: 84, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timerLabel: { fontSize: 12, color: '#6B7280' },
  timerValue: { fontSize: 13, fontWeight: '700' },
  timerBar: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginBottom: 20 },
  timerFill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  codeInput: {
    fontSize: 36, fontWeight: '700', color: '#111827',
    letterSpacing: 12, textAlign: 'center',
    borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, backgroundColor: '#F9FAFB', marginBottom: 8,
  },
  codeInputErr: { borderColor: '#EF4444' },
  errorTxt: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  btn: { backgroundColor: '#1565C0', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelLink: { color: '#1565C0', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 10 },
});