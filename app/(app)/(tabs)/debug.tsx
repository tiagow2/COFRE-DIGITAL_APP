// app/(app)/(tabs)/debug.tsx
import { debugLogger } from '@/services/debugLogger';
import { generateCurrentCode } from '@/services/totp';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface DebugLog {
  timestamp: string;
  label: string;
  data: any;
}

export default function DebugScreen() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [testSecret, setTestSecret] = useState('');
  const [testCode, setTestCode] = useState('');

  const loadLogs = async () => {
    const newLogs = await debugLogger.getLogs();
    setLogs(newLogs.reverse()); // Mostra os mais recentes primeiro
  };

  const handleGenerateCode = () => {
    if (!testSecret) {
      Alert.alert('Erro', 'Digite uma secret');
      return;
    }
    const code = generateCurrentCode(testSecret);
    setTestCode(code);
    debugLogger.log('Teste de código gerado', { secret: testSecret.slice(0, 5) + '...', code });
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 1000); // Atualiza a cada segundo
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = () => {
    Alert.alert('Limpar logs', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await debugLogger.clearLogs();
          setLogs([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Debug Logs</Text>
        <TouchableOpacity style={s.btn} onPress={loadLogs}>
          <Text style={s.btnTxt}>🔄 Recarregar</Text>
        </TouchableOpacity>
      </View>

      {/* 🧪 Seção de Testes */}
      <View style={s.testSection}>
        <Text style={s.testTitle}>🧪 Testar Código TOTP</Text>
        <TextInput
          style={s.testInput}
          placeholder="Cole a secret aqui"
          placeholderTextColor="#9CA3AF"
          value={testSecret}
          onChangeText={setTestSecret}
        />
        <TouchableOpacity style={s.testBtn} onPress={handleGenerateCode}>
          <Text style={s.testBtnTxt}>Gerar Código Agora</Text>
        </TouchableOpacity>
        {testCode && (
          <View style={s.testResult}>
            <Text style={s.testResultLabel}>Código gerado:</Text>
            <Text style={s.testResultCode}>{testCode}</Text>
            <Text style={s.testResultHint}>Use este código para testar (válido por 30s)</Text>
          </View>
        )}
      </View>

      {logs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Nenhum log ainda</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={s.logItem}>
              <Text style={s.logTime}>{item.timestamp}</Text>
              <Text style={s.logLabel}>{item.label}</Text>
              {item.data && (
                <Text style={s.logData}>{JSON.stringify(item.data, null, 2)}</Text>
              )}
            </View>
          )}
          contentContainerStyle={{ padding: 12 }}
        />
      )}

      <View style={s.footer}>
        <TouchableOpacity style={[s.btn, s.clearBtn]} onPress={handleClearLogs}>
          <Text style={s.clearTxt}>Limpar todos os logs</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1565C0', borderRadius: 6 },
  btnTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  testSection: { backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#374151', padding: 16 },
  testTitle: { fontSize: 14, fontWeight: '700', color: '#FBBF24', marginBottom: 12 },
  testInput: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 6, padding: 10, color: '#fff', marginBottom: 10, fontSize: 12, fontFamily: 'monospace' },
  testBtn: { backgroundColor: '#FBBF24', borderRadius: 6, padding: 10, alignItems: 'center' },
  testBtnTxt: { color: '#111827', fontWeight: '600', fontSize: 12 },
  testResult: { marginTop: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#10B981', borderRadius: 6, padding: 12 },
  testResultLabel: { fontSize: 11, color: '#9CA3AF' },
  testResultCode: { fontSize: 24, fontWeight: '700', color: '#10B981', marginVertical: 8, fontFamily: 'monospace', textAlign: 'center' },
  testResultHint: { fontSize: 10, color: '#6B7280', textAlign: 'center' },
  
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTxt: { color: '#9CA3AF', fontSize: 16 },
  logItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  logTime: { fontSize: 11, color: '#60A5FA', fontWeight: '600' },
  logLabel: { fontSize: 13, color: '#fff', fontWeight: '600', marginTop: 4 },
  logData: { fontSize: 11, color: '#D1D5DB', marginTop: 6, fontFamily: 'monospace' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#374151' },
  clearBtn: { backgroundColor: '#DC2626' },
  clearTxt: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
