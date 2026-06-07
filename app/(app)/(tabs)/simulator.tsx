import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { parseCurrencyInput } from '@/utils/currency';

export default function SimulatorScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  
  const [initialAmount, setInitialAmount] = useState('1000');
  const [monthlyDeposit, setMonthlyDeposit] = useState('200');
  const [months, setMonths] = useState('12');

  const [results, setResults] = useState<any>(null);

  const calculate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const p = parseCurrencyInput(initialAmount) || 0;
    const pmt = parseCurrencyInput(monthlyDeposit) || 0;
    const n = Number.parseInt(months, 10) || 0;

    // Fixed Rates approximation
    const rates = {
      poupanca: 0.005, // ~0.5% a.m
      cdb: 0.0083,     // ~0.83% a.m (100% CDI)
      tesouro: 0.0085  // ~0.85% a.m (Selic)
    };

    const calcFV = (rate: number) => {
      // FV = P * (1 + r)^n + PMT * [ ((1 + r)^n - 1) / r ]
      const factor = Math.pow(1 + rate, n);
      return p * factor + pmt * ((factor - 1) / rate);
    };

    const totalInvested = p + pmt * n;

    setResults({
      totalInvested,
      poupanca: calcFV(rates.poupanca),
      cdb: calcFV(rates.cdb),
      tesouro: calcFV(rates.tesouro)
    });
  };

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const bestValue = results ? Math.max(results.poupanca, results.cdb, results.tesouro) : 0;
  const isBest = (val: number) => val === bestValue;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Simulador</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.description}>
          Simule seus investimentos em diferentes cenários e compare a rentabilidade.
        </Text>

        <View style={s.card}>
          <Text style={s.label}>Valor Inicial (R$)</Text>
          <TextInput 
            style={s.input} 
            value={initialAmount} 
            onChangeText={setInitialAmount} 
            keyboardType="numeric" 
          />

          <Text style={s.label}>Depósito Mensal (R$)</Text>
          <TextInput 
            style={s.input} 
            value={monthlyDeposit} 
            onChangeText={setMonthlyDeposit} 
            keyboardType="numeric" 
          />

          <Text style={s.label}>Prazo (Meses)</Text>
          <TextInput 
            style={s.input} 
            value={months} 
            onChangeText={setMonths} 
            keyboardType="numeric" 
          />

          <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} onPress={calculate}>
            <Text style={s.btnTxt}>Calcular Rendimento</Text>
          </TouchableOpacity>
        </View>

        {results && (
          <View style={s.resultsCard}>
            <Text style={s.resTitle} numberOfLines={1}>Resultados em {months} meses</Text>
            <Text style={s.invested} numberOfLines={1} adjustsFontSizeToFit>Valor investido: {fmt(results.totalInvested)}</Text>

            <View style={s.resItem}>
              <View style={[s.resIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="wallet-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.resName} numberOfLines={1}>Poupança {isBest(results.poupanca) && '🏆'}</Text>
                <Text style={s.resYield} numberOfLines={1}>Rendimento: +{fmt(results.poupanca - results.totalInvested)}</Text>
              </View>
              <Text style={[s.resVal, { color: '#EF4444' }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{fmt(results.poupanca)}</Text>
            </View>

            <View style={s.resItem}>
              <View style={[s.resIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="trending-up-outline" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.resName} numberOfLines={1}>CDB (100% CDI) {isBest(results.cdb) && '🏆'}</Text>
                <Text style={s.resYield} numberOfLines={1}>Rendimento: +{fmt(results.cdb - results.totalInvested)}</Text>
              </View>
              <Text style={[s.resVal, { color: '#3B82F6' }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{fmt(results.cdb)}</Text>
            </View>

            <View style={[s.resItem, { borderBottomWidth: 0 }]}>
              <View style={[s.resIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.resName} numberOfLines={1}>Tesouro Direto {isBest(results.tesouro) && '🏆'}</Text>
                <Text style={s.resYield} numberOfLines={1}>Rendimento: +{fmt(results.tesouro - results.totalInvested)}</Text>
              </View>
              <Text style={[s.resVal, { color: '#10B981' }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{fmt(results.tesouro)}</Text>
            </View>

            <Text style={s.tip}>
              Dica: O Tesouro Direto e o CDB costumam render muito mais que a poupança com riscos semelhantes.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 140 },
  description: { fontSize: 15, color: '#6B7280', marginBottom: 20, lineHeight: 22 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 0, backgroundColor: '#F1F5F9', borderRadius: 16, padding: 16, fontSize: 16, marginBottom: 16, color: '#111827', fontWeight: '600' },
  btn: { backgroundColor: '#111827', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultsCard: { backgroundColor: '#fff', padding: 24, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  resTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4, minWidth: 0 },
  invested: { fontSize: 12, color: '#6B7280', marginBottom: 20, flexShrink: 1, minWidth: 0 },
  resItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', overflow: 'hidden', minWidth: 0 },
  resIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resName: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1, minWidth: 0 },
  resYield: { fontSize: 11, color: '#6B7280', marginTop: 2, flexShrink: 1, minWidth: 0 },
  resVal: { fontSize: 12, fontWeight: '700', flexShrink: 0, minWidth: 0, maxWidth: 112 },
  tip: { fontSize: 13, color: '#4B5563', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginTop: 16, lineHeight: 20 }
});
