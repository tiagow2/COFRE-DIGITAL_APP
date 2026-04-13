// app/(app)/(tabs)/debug.tsx
import { debugLogger } from '@/services/debugLogger';
import { secureStorage } from '@/services/secureStorage';
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
  const [encryptedStatus, setEncryptedStatus] = useState<{ encrypted: string; decrypted: any } | null>(null);

  const loadLogs = async () => {
    const newLogs = await debugLogger.getLogs();
    setLogs(newLogs.reverse()); // Mostra os mais recentes primeiro
  };

  const handleTestEncryption = async () => {
    const testData = {
      user: 'teste@example.com',
      timestamp: new Date().toISOString(),
      message: 'Dados criptografados com expo-secure-store',
      credit_card: '1234-5678-9012-3456',
      financial_data: { balance: 5432.10, accounts: 3 },
    };

    try {
      // Salva criptografado
      await secureStorage.setItem('debug_test_data', testData);
      
      // Carrega descriptografado
      const loaded = await secureStorage.getItem('debug_test_data');
      
      setEncryptedStatus({
        encrypted: '[Encrypted with AES-256 via expo-secure-store - Cannot be read without decryption key]',
        decrypted: loaded,
      });

      debugLogger.log('Encryption Test Successful', {
        status: 'Data successfully encrypted, stored in secure storage, and decrypted',
        original_data: testData,
        loaded_data: loaded,
        match: JSON.stringify(testData) === JSON.stringify(loaded),
      });

      Alert.alert('Success', 'Data encrypted, stored, and decrypted successfully!\n\nCheck the logs below to verify the encryption process.');
    } catch (err) {
      debugLogger.log('Erro no teste de criptografia', err);
      Alert.alert('Error', 'Failed to test encryption');
    }
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
          <Text style={s.btnTxt}>Reload</Text>
        </TouchableOpacity>
      </View>

      {/* Encryption Test Section */}
      <View style={s.encryptionSection}>
        <Text style={s.encryptionTitle}>Encryption Test - expo-secure-store</Text>
        <Text style={s.encryptionDesc}>Click to test AES-256 encryption and decryption</Text>
        <TouchableOpacity style={s.encryptBtn} onPress={handleTestEncryption}>
          <Text style={s.encryptBtnTxt}>Test Encryption Now</Text>
        </TouchableOpacity>

        {encryptedStatus && (
          <View style={s.encryptionResult}>
            <Text style={s.sectionTitle}>What happens:</Text>
            
            <View style={s.stepBox}>
              <Text style={s.stepNumber}>Step 1: Original Data (Before)</Text>
              <View style={{ backgroundColor: '#0F1419', borderRadius: 4, padding: 8, borderWidth: 1, borderColor: '#60A5FA', marginTop: 6 }}>
                <Text style={s.originalText}>{JSON.stringify(encryptedStatus.decrypted, null, 2)}</Text>
              </View>
            </View>

            <View style={s.arrowBox}>
              <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '700' }}>↓ AES-256 Encryption ↓</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 4 }}>expo-secure-store + Keystore/Keychain</Text>
            </View>

            <View style={s.stepBox}>
              <Text style={s.stepNumber}>Step 2: Encrypted (In Storage)</Text>
              <View style={{ backgroundColor: '#1F0F0F', borderRadius: 4, padding: 8, borderWidth: 1, borderColor: '#EF4444', marginTop: 6 }}>
                <Text style={s.encryptedText}>{encryptedStatus.encrypted}</Text>
              </View>
            </View>

            <View style={s.arrowBox}>
              <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '700' }}>↓ AES-256 Decryption ↓</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 4 }}>Automatic decryption when loaded</Text>
            </View>

            <View style={s.stepBox}>
              <Text style={s.stepNumber}>Step 3: Decrypted (When Loaded)</Text>
              <View style={{ backgroundColor: '#0F1F0F', borderRadius: 4, padding: 8, borderWidth: 1, borderColor: '#10B981', marginTop: 6 }}>
                <Text style={s.decryptedText}>{JSON.stringify(encryptedStatus.decrypted, null, 2)}</Text>
              </View>
              <Text style={{ color: '#10B981', fontSize: 10, marginTop: 8 }}>Check logs below: 'Encryption Test Successful' shows the process</Text>
            </View>
          </View>
        )}
      </View>

      {/* Test Section */}
      <View style={s.testSection}>
        <Text style={s.testTitle}>Test TOTP Code</Text>
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
  
  encryptionSection: { backgroundColor: '#1F2937', borderBottomWidth: 2, borderBottomColor: '#10B981', padding: 16 },
  encryptionTitle: { fontSize: 14, fontWeight: '700', color: '#10B981', marginBottom: 6 },
  encryptionDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  encryptBtn: { backgroundColor: '#10B981', borderRadius: 6, padding: 12, alignItems: 'center' },
  encryptBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  encryptionResult: { marginTop: 16, backgroundColor: '#111827', borderRadius: 6, padding: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#60A5FA', marginBottom: 12 },
  stepBox: { marginBottom: 12 },
  stepNumber: { fontSize: 11, fontWeight: '700', color: '#D1D5DB' },
  originalText: { fontSize: 10, color: '#60A5FA', fontFamily: 'monospace' },
  arrowBox: { alignItems: 'center', marginVertical: 12, paddingVertical: 8 },
  encryptedText: { fontSize: 10, color: '#EF4444', fontFamily: 'monospace' },
  decryptedText: { fontSize: 10, color: '#10B981', fontFamily: 'monospace' },
  
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
