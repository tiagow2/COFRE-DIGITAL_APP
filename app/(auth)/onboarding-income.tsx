import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function OnboardingIncomeScreen() {
  const router = useRouter();
  const [income, setIncome] = useState('');
  const [city, setCity]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    router.replace('/(app)/(tabs)');
  };

  return (
    <LinearGradient colors={['#1565C0', '#1E40AF']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.iconWrap}>
            <Ionicons name="wallet-outline" size={36} color="#fff" />
          </View>
          <Text style={s.title}>Vamos começar!</Text>
          <Text style={s.sub}>Informe sua renda mensal para que possamos ajudá-lo a criar orçamentos personalizados.</Text>

          <View style={s.card}>
            <Text style={s.label}>Renda mensal líquida (R$)</Text>
            <TextInput style={s.input} value={income} onChangeText={setIncome} placeholder="Ex: 5000,00" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
            <Text style={s.label}>Cidade</Text>
            <TextInput style={[s.input, { marginBottom: 0 }]} value={city} onChangeText={setCity} placeholder="Ex: São Paulo" placeholderTextColor="#9CA3AF" />
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleContinue} disabled={loading}>
            {loading ? <ActivityIndicator color="#1565C0" /> : <Text style={s.btnTxt}>Começar a usar →</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(app)/(tabs)')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Pular por agora</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  sub:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 32 },
  card:  { backgroundColor: '#fff', borderRadius: 24, padding: 24, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  btn:   { backgroundColor: '#fff', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#1565C0', fontSize: 16, fontWeight: '700' },
});
