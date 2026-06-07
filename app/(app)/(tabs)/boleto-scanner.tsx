import { CreditCard, useFinance } from '@/context/FinanceContext';
import { formatBoletoDueDate, ParsedBoleto, parseBoletoCode } from '@/services/boletoService';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function cardLimit(card: CreditCard) {
  return (card as any).limitAmount || card.limit || 0;
}

export default function BoletoScannerScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  const { addTransaction, creditCards, loadingData } = useFinance();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ParsedBoleto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'credit_card'>('balance');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCard = useMemo(
    () => creditCards.find((card) => card.id === selectedCardId) ?? null,
    [creditCards, selectedCardId]
  );

  const resetBoletoInput = () => {
    setCode('');
    setResult(null);
    setScanned(false);
    setPaymentMethod('balance');
    setSelectedCardId('');
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        Alert.alert('Permissao necessaria', 'Permita o uso da camera para ler boleto por codigo de barras ou QR Code.');
        return;
      }
    }

    setScanned(false);
    setCameraOpen(true);
  };

  const applyParsedResult = (parsed: ParsedBoleto) => {
    setResult(parsed);
    setCode(parsed.original);
    setPaymentMethod('balance');
    setSelectedCardId('');
  };

  const handleParse = () => {
    if (!code.trim()) {
      Alert.alert('Erro', 'Cole, digite ou escaneie o codigo do boleto.');
      return;
    }

    const parsed = parseBoletoCode(code);
    if (!parsed) {
      Alert.alert(
        'Formato invalido',
        'Use codigo de barras bancario de 44 digitos, linha digitavel bancaria de 47 digitos ou conta de consumo de 48 digitos.'
      );
      return;
    }

    applyParsedResult(parsed);
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseBoletoCode(data);
    if (!parsed) {
      Alert.alert('Codigo lido', 'O codigo escaneado nao parece ser boleto ou conta de consumo.', [
        { text: 'Tentar de novo', onPress: () => setScanned(false) },
      ]);
      return;
    }

    applyParsedResult(parsed);
    setCameraOpen(false);
  };

  const validatePayment = () => {
    if (!result || result.amount <= 0) {
      Alert.alert('Valor nao encontrado', 'Nao foi possivel identificar um valor valido neste boleto.');
      return false;
    }

    if (paymentMethod === 'credit_card') {
      if (!selectedCard) {
        Alert.alert('Escolha um cartao', 'Selecione um cartao para registrar este pagamento.');
        return false;
      }

      const available = cardLimit(selectedCard) - selectedCard.used;
      if (result.amount > available) {
        Alert.alert('Limite insuficiente', `Este cartao tem ${fmt(Math.max(available, 0))} disponivel.`);
        return false;
      }
    }

    return true;
  };

  const handleConfirm = async () => {
    if (!validatePayment() || !result) return;
    if (loadingData) {
      Alert.alert('Aguarde', 'Seus dados ainda estao carregando.');
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type: 'expense',
        description: `${result.bankName} - boleto${result.dueDate ? ` venc. ${formatBoletoDueDate(result.dueDate)}` : ''}`,
        amount: result.amount,
        category: result.type === 'utility' ? 'Moradia' : 'Outros',
        icon: result.type === 'utility' ? 'flash-outline' : 'barcode-outline',
        paymentMethod,
        creditCardId: paymentMethod === 'credit_card' ? selectedCard?.id : undefined,
        creditCardName: paymentMethod === 'credit_card' ? selectedCard?.name : undefined,
      });

      Alert.alert(
        'Boleto registrado',
        paymentMethod === 'credit_card'
          ? `Valor: ${result.amountText}\nLancado na fatura do cartao ${selectedCard?.name}.`
          : `Valor: ${result.amountText}\nLancado como despesa no saldo.`,
        [
          {
            text: 'Ler outro',
            onPress: resetBoletoInput,
          },
          {
            text: 'Voltar',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving boleto:', error);
      Alert.alert('Erro', (error as Error).message || 'Nao foi possivel registrar o boleto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Ler boleto</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={[s.cameraButton, { backgroundColor: theme.accent }]} onPress={openCamera}>
          <Ionicons name="scan-outline" size={22} color="#fff" />
          <Text style={s.cameraButtonText}>Escanear com camera</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.fieldLabel}>Linha digitavel ou codigo de barras</Text>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setResult(null);
            }}
            placeholder="Cole ou digite o codigo do boleto"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={[s.parseButton, { borderColor: theme.accent }]} onPress={handleParse}>
            <Ionicons name="barcode-outline" size={18} color={theme.accent} />
            <Text style={[s.parseButtonText, { color: theme.accent }]}>Identificar boleto</Text>
          </TouchableOpacity>
          {(code || result) && (
            <TouchableOpacity style={s.clearButton} onPress={resetBoletoInput}>
              <Ionicons name="refresh-outline" size={17} color="#6B7280" />
              <Text style={s.clearButtonText}>Limpar e ler outro código</Text>
            </TouchableOpacity>
          )}
        </View>

        {result && (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <View style={[s.resultIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="checkmark-circle" size={26} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.resultTitle} numberOfLines={1}>{result.bankName}</Text>
                <Text style={s.resultSubtitle}>{result.type === 'utility' ? 'Conta de consumo' : 'Boleto bancario'}</Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Valor</Text>
              <Text style={s.infoValue} numberOfLines={1} adjustsFontSizeToFit>{result.amountText}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Vencimento</Text>
              <Text style={s.infoValue} numberOfLines={1}>{formatBoletoDueDate(result.dueDate)}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Codigo</Text>
              <Text style={s.infoValueSmall} numberOfLines={1}>{result.barcode}</Text>
            </View>

            {result.warnings.length > 0 && (
              <View style={s.warningBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
                <Text style={s.warningText}>
                  Alguns digitos verificadores nao bateram. Confira o codigo antes de registrar.
                </Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Registrar pagamento em</Text>
            <View style={s.paymentList}>
              <TouchableOpacity
                style={[s.paymentOption, paymentMethod === 'balance' && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                onPress={() => {
                  setPaymentMethod('balance');
                  setSelectedCardId('');
                }}
              >
                <Ionicons name="wallet-outline" size={18} color={paymentMethod === 'balance' ? theme.accent : '#6B7280'} />
                <Text style={[s.paymentText, paymentMethod === 'balance' && { color: theme.accent }]}>Saldo</Text>
              </TouchableOpacity>

              {creditCards.map((card) => {
                const available = Math.max(cardLimit(card) - card.used, 0);
                const active = paymentMethod === 'credit_card' && selectedCardId === card.id;
                return (
                  <TouchableOpacity
                    key={card.id}
                    style={[s.paymentOption, active && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                    onPress={() => {
                      setPaymentMethod('credit_card');
                      setSelectedCardId(card.id);
                    }}
                  >
                    <Ionicons name="card-outline" size={18} color={active ? theme.accent : '#6B7280'} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.paymentText, active && { color: theme.accent }]} numberOfLines={1}>{card.name}</Text>
                      <Text style={s.paymentSub} numberOfLines={1}>{fmt(available)} disponivel</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: theme.accent }, (saving || loadingData) && s.disabled]}
              onPress={handleConfirm}
              disabled={saving || loadingData}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>Registrar boleto</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={resetBoletoInput} disabled={saving}>
              <Ionicons name="refresh-outline" size={17} color="#6B7280" />
              <Text style={s.secondaryBtnText}>Ler outro boleto</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={s.cameraScreen}>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417', 'code128', 'code39', 'ean13', 'itf14'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          >
            <SafeAreaView style={s.cameraOverlay}>
              <View style={s.cameraTop}>
                <TouchableOpacity style={s.closeCamera} onPress={() => setCameraOpen(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={s.cameraTitle}>Aponte para o codigo</Text>
              </View>
              <View style={s.scanFrame} />
              {scanned && (
                <TouchableOpacity style={s.scanAgain} onPress={() => setScanned(false)}>
                  <Text style={s.scanAgainText}>Escanear novamente</Text>
                </TouchableOpacity>
              )}
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 80 },
  cameraButton: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 16 },
  cameraButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, minHeight: 96, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', textAlignVertical: 'top', marginBottom: 14 },
  parseButton: { height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  parseButtonText: { fontSize: 14, fontWeight: '800' },
  clearButton: { height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10, backgroundColor: '#F3F4F6' },
  clearButtonText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  resultCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#D1FAE5' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  resultSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 13, color: '#6B7280', flexShrink: 0 },
  infoValue: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 15, fontWeight: '800', color: '#111827' },
  infoValueSmall: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#374151' },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', marginVertical: 14 },
  warningText: { flex: 1, minWidth: 0, fontSize: 12, color: '#92400E', lineHeight: 17 },
  paymentList: { gap: 8, marginBottom: 18 },
  paymentOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  paymentText: { fontSize: 14, fontWeight: '800', color: '#374151' },
  paymentSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  confirmBtn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  confirmBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10, backgroundColor: '#F3F4F6' },
  secondaryBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 24 },
  cameraTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  closeCamera: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, minWidth: 0 },
  scanFrame: { alignSelf: 'center', width: '86%', maxWidth: 340, aspectRatio: 1.65, borderRadius: 18, borderWidth: 3, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.04)' },
  scanAgain: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12 },
  scanAgainText: { color: '#111827', fontWeight: '800' },
});
