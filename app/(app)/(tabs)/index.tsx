import { SignaturePad } from '@/components/DigitalSignature';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { profileService } from '@/services/profileService';
import { compareSignatures } from '@/services/signatureValidation';
import { parseCurrencyInput } from '@/utils/currency';
import { normalizeSignatureValue } from '@/utils/signatureData';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = [
  { name: 'Alimentação', icon: 'restaurant-outline',       bg: '#FEF3C7', color: '#D97706' },
  { name: 'Transporte',  icon: 'car-outline',               bg: '#D1FAE5', color: '#059669' },
  { name: 'Lazer',       icon: 'game-controller-outline',   bg: '#FCE7F3', color: '#DB2777' },
  { name: 'Saúde',       icon: 'medical-outline',           bg: '#DCFCE7', color: '#16A34A' },
  { name: 'Moradia',     icon: 'home-outline',              bg: '#DBEAFE', color: '#2563EB' },
  { name: 'Educação',    icon: 'book-outline',              bg: '#EDE9FE', color: '#7C3AED' },
  { name: 'Outros',      icon: 'ellipsis-horizontal-outline', bg: '#F3F4F6', color: '#4B5563' },
];
const HIGH_VALUE = 5000;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function HomeScreen() {
  const { user } = useAuth();
  const { transactions, budgets, challenges, getBalance, getMonthlyIncome,
    getMonthlyExpenses, getBudgetStatus, addTransaction, suggestCategory, loadingData, creditCards } = useFinance();
  const theme = useFinancialTheme();
  const router = useRouter();

  const [modal, setModal]             = useState(false);
  const [txType, setTxType]           = useState<'expense' | 'income'>('expense');
  const [desc, setDesc]               = useState('');
  const [amount, setAmount]           = useState('');
  const [category, setCategory]       = useState('Alimentação');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'credit_card'>('balance');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [profileSignature, setProfileSignature] = useState<string | undefined>();
  const [signModal, setSignModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [validatingSignature, setValidatingSignature] = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
  const balance   = getBalance();
  const recent    = transactions.slice(0, 5);
  const activeChallenges = challenges.filter((c: any) => c.status === 'active').slice(0, 2);
  const selectedCard = creditCards.find((card) => card.id === selectedCardId);

  const resetTransactionForm = () => {
    setDesc('');
    setAmount('');
    setReceiptPhoto(null);
    setTxType('expense');
    setCategory('Alimentação');
    setPaymentMethod('balance');
    setSelectedCardId('');
  };

  useEffect(() => {
    if (!user?.uid) {
      setProfileSignature(undefined);
      return;
    }

    profileService.load(user.uid).then((profile) => {
      setProfileSignature(profile?.signature ? normalizeSignatureValue(profile.signature) : undefined);
    });
  }, [user?.uid, modal]);

  const loadSavedSignature = async () => {
    if (!user?.uid) return undefined;
    const profile = await profileService.load(user.uid);
    const savedSignature = profile?.signature ? normalizeSignatureValue(profile.signature) : undefined;
    setProfileSignature(savedSignature);
    return savedSignature;
  };

  const handleDescChange = (text: string) => {
    setDesc(text);
    if (text.length > 2) setCategory(suggestCategory(text));
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita acesso à câmera.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, base64: true, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    const v = parseCurrencyInput(amount);
    if (loadingData) { Alert.alert('Aguarde', 'Seus dados ainda estão carregando.'); return; }
    if (!desc.trim()) { Alert.alert('Erro', 'Informe a descrição.'); return; }
    if (!Number.isFinite(v) || v <= 0)  { Alert.alert('Erro', 'Informe um valor válido.'); return; }

    if (txType === 'expense' && paymentMethod === 'credit_card') {
      if (!selectedCard) {
        Alert.alert('Escolha um cartão', 'Selecione o cartão usado nessa despesa.');
        return;
      }
      const available = Math.max(selectedCard.limit - selectedCard.used, 0);
      if (v > available) {
        Alert.alert('Limite insuficiente', `Esse cartão tem ${fmt(available)} disponível.`);
        return;
      }
    }

    if (txType === 'expense' && v >= HIGH_VALUE) {
      const savedSignature = profileSignature || await loadSavedSignature();
      if (!savedSignature) {
        Alert.alert(
          'Assinatura necessária',
          'Cadastre sua assinatura digital no perfil antes de salvar transações de alto valor.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cadastrar', onPress: () => { setModal(false); router.push('/(app)/(tabs)/profile-edit' as never); } },
          ]
        );
        return;
      }
      setProfileSignature(savedSignature);
      setSignModal(true);
      return;
    }
    await doSave(v);
  };

  const doSave = async (v: number, signature?: string, signatureScore = 0) => {
    if (saving) return;
    setSaving(true);
    try {
      const savedCategory = txType === 'income' ? 'Receita' : category;
      const cat = CATEGORIES.find(c => c.name === savedCategory);
      await addTransaction({
        type: txType, description: desc.trim(), amount: v,
        category: savedCategory,
        icon: txType === 'income' ? 'wallet-outline' : cat?.icon ?? 'ellipsis-horizontal-outline',
        paymentMethod: txType === 'expense' ? paymentMethod : 'balance',
        creditCardId: txType === 'expense' && paymentMethod === 'credit_card' ? selectedCard?.id : undefined,
        creditCardName: txType === 'expense' && paymentMethod === 'credit_card' ? selectedCard?.name : undefined,
        signatureRequired: txType === 'expense' && v >= HIGH_VALUE,
        signatureApproved: txType === 'expense' && v >= HIGH_VALUE ? !!signature : false,
        signatureScore,
        photo: receiptPhoto ?? undefined,
        signature,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(false);
      resetTransactionForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Erro', (error as Error).message || 'Não foi possível salvar a transação.');
    } finally {
      setSaving(false);
    }
  };

  const closeSignModal = () => {
    setValidatingSignature(false);
    setSignModal(false);
  };

  const handleSignOK = async (sig: string) => {
    const savedSignature = profileSignature || await loadSavedSignature();
    if (!savedSignature) {
      closeSignModal();
      Alert.alert('Assinatura não cadastrada', 'Cadastre uma assinatura no perfil para confirmar transações de alto valor.');
      return;
    }

    const candidateSignature = normalizeSignatureValue(sig);
    if (!candidateSignature) {
      setValidatingSignature(false);
      Alert.alert('Assinatura vazia', 'Por favor, assine antes de confirmar.');
      return;
    }

    setValidatingSignature(true);
    const result = compareSignatures(savedSignature, candidateSignature);
    if (!result.accepted) {
      setValidatingSignature(false);
      Alert.alert(
        'Assinatura não confere',
        `A assinatura desenhada não foi compatível com a assinatura salva. Compatibilidade: ${Math.round(result.score * 100)}%.`
      );
      return;
    }

    setSignModal(false);
    const v = parseCurrencyInput(amount);
    await doSave(v, candidateSignature, result.score);
    setValidatingSignature(false);
  };

  const catInfo = (tx: any) => {
    const c = CATEGORIES.find(c2 => c2.name === tx.category);
    return tx.type === 'income'
      ? { icon: 'arrow-up-circle-outline', bg: '#D1FAE5', color: '#059669' }
      : { icon: c?.icon ?? 'ellipsis-horizontal-outline', bg: c?.bg ?? '#F3F4F6', color: c?.color ?? '#4B5563' };
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Text style={s.greeting} numberOfLines={1}>{greeting}, {firstName} 👋</Text>
            <Text style={s.subtitle} numberOfLines={1}>Veja como está seu cofre hoje</Text>
          </View>
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/(tabs)/settings' as never);
            }}
          >
            <Ionicons name="person-circle-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Saldo */}
        <LinearGradient colors={[theme.accent, theme.accentDark]} style={[s.balanceCard, { shadowColor: theme.accent }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.balLabel}>Saldo disponível</Text>
          <Text style={s.balValue} adjustsFontSizeToFit numberOfLines={1}>{fmt(balance)}</Text>
          <View style={s.balRow}>
            <View style={s.balItem}>
              <Ionicons name="arrow-down-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
              <View style={{ marginLeft: 6, flex: 1, minWidth: 0 }}>
                <Text style={s.balItemLabel}>Receitas</Text>
                <Text style={s.balItemVal} numberOfLines={1} adjustsFontSizeToFit>{fmt(getMonthlyIncome())}</Text>
              </View>
            </View>
            <View style={s.balDivider} />
            <View style={s.balItem}>
              <Ionicons name="arrow-up-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
              <View style={{ marginLeft: 6, flex: 1, minWidth: 0 }}>
                <Text style={s.balItemLabel}>Despesas</Text>
                <Text style={s.balItemVal} numberOfLines={1} adjustsFontSizeToFit>{fmt(getMonthlyExpenses())}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Ações rápidas */}
        <View style={s.quickActions}>
          {[
            { label: 'Adicionar',   icon: 'add-circle-outline',    color: theme.accent, bg: theme.accentSoft,  action: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModal(true); } },
            { label: 'Cartões',     icon: 'card-outline',           color: '#7C3AED', bg: '#F5F3FF',  action: () => router.push('/(app)/(tabs)/credit-cards' as never) },
            { label: 'Boleto',      icon: 'barcode-outline',        color: '#D97706', bg: '#FFFBEB',  action: () => router.push('/(app)/(tabs)/boleto-scanner' as never) },
            { label: 'Simulador',   icon: 'calculator-outline',     color: '#059669', bg: '#F0FDF4',  action: () => router.push('/(app)/(tabs)/simulator' as never) },
          ].map(a => (
            <TouchableOpacity key={a.label} style={s.quickBtn} onPress={a.action} activeOpacity={0.75}>
              <View style={[s.quickIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={s.quickLabel} numberOfLines={1}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Orçamentos com alerta */}
        {budgets.filter((b: any) => getBudgetStatus(b).pct >= 80).length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>⚠️ Orçamentos no limite</Text>
            </View>
            {budgets.filter((b: any) => getBudgetStatus(b).pct >= 80).slice(0, 3).map((b: any) => {
              const { spent, pct } = getBudgetStatus(b);
              return (
                <View key={b.id} style={s.alertCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <Text style={s.alertName} numberOfLines={1}>{b.category}</Text>
                      <Text style={[s.alertPct, { color: pct >= 100 ? '#EF4444' : '#F59E0B' }]} numberOfLines={1}>{pct}%</Text>
                    </View>
                    <View style={s.progBg}>
                      <View style={[s.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 100 ? '#EF4444' : '#F59E0B' }]} />
                    </View>
                    <Text style={s.alertSub}>{fmt(spent)} de {fmt(b.limit)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Desafios ativos */}
        {activeChallenges.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>🏆 Desafios ativos</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/challenges' as never)}>
                <Text style={s.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {activeChallenges.map((c: any) => {
                const pct = Math.min(Math.round((c.currentAmount / c.targetAmount) * 100), 100);
                return (
                  <View key={c.id} style={s.challengeCard}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>🎯</Text>
                    <Text style={s.challengeTitle} numberOfLines={1}>{c.title}</Text>
                    <View style={s.progBg}><View style={[s.progFill, { width: `${pct}%`, backgroundColor: '#F59E0B' }]} /></View>
                    <Text style={s.challengeSub}>{fmt(c.currentAmount)} / {fmt(c.targetAmount)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Transações recentes */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Transações recentes</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/extrato' as never)}>
            <Text style={s.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconBg}><Ionicons name="receipt-outline" size={28} color="#9CA3AF" /></View>
            <Text style={s.emptyTitle}>Nenhuma transação</Text>
            <Text style={s.emptyDesc}>Registre sua primeira receita ou despesa.</Text>
            <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setModal(true)}>
              <Text style={s.emptyBtnTxt}>Adicionar transação</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.txCard}>
            {recent.map((tx: any, i: number) => {
              const ci = catInfo(tx);
              return (
                <View key={tx.id} style={[s.txRow, i === recent.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.txIcon, { backgroundColor: ci.bg }]}>
                    <Ionicons name={ci.icon as any} size={18} color={ci.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={s.txCat} numberOfLines={1}>
                      {tx.creditCardName ? `${tx.category} - ${tx.creditCardName}` : tx.category}
                    </Text>
                  </View>
                  <Text style={[s.txAmt, { color: tx.type === 'income' ? '#059669' : '#EF4444' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent, shadowColor: theme.accent }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setModal(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal: Adicionar transação */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModal(false)}>
            <TouchableOpacity activeOpacity={1} style={s.sheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.sheetContent}
              >
              <View style={s.handle} />
              <Text style={s.sheetTitle}>Nova transação</Text>

              {/* Tipo */}
              <View style={s.typeRow}>
                {(['expense', 'income'] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.typeBtn, txType === t && (t === 'expense' ? s.typeBtnExpActive : s.typeBtnIncActive)]} onPress={() => { Haptics.selectionAsync(); setTxType(t); if (t === 'income') { setPaymentMethod('balance'); setSelectedCardId(''); } }}>
                    <Ionicons name={t === 'expense' ? 'arrow-up' : 'arrow-down'} size={14} color={txType === t ? '#fff' : '#6B7280'} />
                    <Text style={[s.typeTxt, txType === t && { color: '#fff' }]}>{t === 'expense' ? 'Despesa' : 'Receita'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Descrição</Text>
              <TextInput style={s.input} placeholder="Ex: Supermercado, Salário..." placeholderTextColor="#9CA3AF" value={desc} onChangeText={handleDescChange} />

              <Text style={s.fieldLabel}>Valor (R$)</Text>
              <TextInput style={s.input} placeholder="0,00" placeholderTextColor="#9CA3AF" value={amount} onChangeText={setAmount} keyboardType="numeric" />

              {txType === 'expense' && (
                <>
                  <Text style={s.fieldLabel}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {CATEGORIES.map(c => (
                      <TouchableOpacity key={c.name} style={[s.catChip, category === c.name && s.catChipActive]} onPress={() => { Haptics.selectionAsync(); setCategory(c.name); }}>
                        <View style={[s.catChipIcon, { backgroundColor: c.bg }]}>
                          <Ionicons name={c.icon as any} size={14} color={c.color} />
                        </View>
                        <Text style={[s.catChipTxt, category === c.name && { color: '#1565C0', fontWeight: '700' }]}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={s.fieldLabel}>Pagamento</Text>
                  <View style={s.payList}>
                    <TouchableOpacity
                      style={[s.payOption, paymentMethod === 'balance' && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                      onPress={() => { setPaymentMethod('balance'); setSelectedCardId(''); }}
                    >
                      <Ionicons name="wallet-outline" size={18} color={paymentMethod === 'balance' ? theme.accent : '#6B7280'} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.payTitle, paymentMethod === 'balance' && { color: theme.accent }]} numberOfLines={1}>Saldo da conta</Text>
                        <Text style={s.paySub} numberOfLines={1}>Desconta do saldo disponível</Text>
                      </View>
                    </TouchableOpacity>

                    {creditCards.map((card) => {
                      const available = Math.max(card.limit - card.used, 0);
                      const active = paymentMethod === 'credit_card' && selectedCardId === card.id;
                      return (
                        <TouchableOpacity
                          key={card.id}
                          style={[s.payOption, active && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                          onPress={() => { setPaymentMethod('credit_card'); setSelectedCardId(card.id); }}
                        >
                          <Ionicons name="card-outline" size={18} color={active ? theme.accent : '#6B7280'} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[s.payTitle, active && { color: theme.accent }]} numberOfLines={1}>{card.name}</Text>
                            <Text style={s.paySub} numberOfLines={1}>{fmt(available)} disponível na fatura</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Foto comprovante */}
                  <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto}>
                    <Ionicons name="camera-outline" size={18} color={receiptPhoto ? '#059669' : '#6B7280'} />
                    <Text style={[s.photoBtnTxt, receiptPhoto && { color: '#059669' }]}>
                      {receiptPhoto ? '✓ Comprovante anexado' : 'Fotografar comprovante (opcional)'}
                    </Text>
                  </TouchableOpacity>
                  {receiptPhoto && (
                    <>
                      <Image source={{ uri: receiptPhoto }} style={s.receiptThumb} resizeMode="cover" />
                    </>
                  )}
                  {parseCurrencyInput(amount) >= HIGH_VALUE && (
                    <View style={s.signBanner}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#1565C0" />
                      <Text style={s.signBannerTxt}>Valor alto: a assinatura será comparada com a assinatura salva no perfil.</Text>
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.accent }, (saving || loadingData) && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || loadingData}
              >
                <Text style={s.saveBtnTxt}>{saving ? 'Salvando...' : 'Salvar transação'}</Text>
              </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Assinatura */}
      <Modal visible={signModal} animationType="slide" onRequestClose={closeSignModal}>
        <SafeAreaView style={s.signatureSafe}>
          <View style={s.signatureModalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.signatureModalTitle}>Assinatura digital</Text>
              <Text style={s.signatureModalSub}>
              Transação de alto valor: assine novamente para validar com a assinatura salva no perfil.
              </Text>
            </View>
            <TouchableOpacity style={s.signatureIconBtn} onPress={closeSignModal}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <View style={s.signatureCanvasWrap}>
            <SignaturePad
              accentColor={theme.accent}
              saving={validatingSignature || saving}
              saveLabel="Confirmar assinatura"
              savingLabel="Validando..."
              onSave={handleSignOK}
            />
          </View>
          <TouchableOpacity style={s.signatureCancelBtn} onPress={closeSignModal} disabled={validatingSignature || saving}>
            <Text style={s.signatureCancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 0 },
  subtitle:  { fontSize: 13, color: '#6B7280', marginTop: 2, minWidth: 0 },
  notifBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },

  balanceCard: { marginHorizontal: 20, borderRadius: 28, padding: 24, marginBottom: 20, shadowColor: '#1565C0', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  balLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  balValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginBottom: 20, letterSpacing: 0 },
  balRow:   { flexDirection: 'row', alignItems: 'center' },
  balItem:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  balDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  balItemLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },
  balItemVal:   { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2, minWidth: 0 },

  quickActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginHorizontal: 20, marginBottom: 24 },
  quickBtn:  { alignItems: 'center', flex: 1, minWidth: 0 },
  quickIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  quickLabel: { fontSize: 11, color: '#374151', fontWeight: '600', maxWidth: '100%' },

  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  seeAll:       { fontSize: 13, color: '#1565C0', fontWeight: '600', flexShrink: 0 },

  alertCard: { marginHorizontal: 20, backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A' },
  alertName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  alertPct:  { fontSize: 14, fontWeight: '700', flexShrink: 0 },
  alertSub:  { fontSize: 12, color: '#6B7280', marginTop: 6 },

  challengeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, width: 160, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  challengeTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 10 },
  challengeSub:   { fontSize: 11, color: '#6B7280', marginTop: 6 },

  txCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  txRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  txIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#111827', minWidth: 0 },
  txCat:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmt:  { fontSize: 14, fontWeight: '700', flexShrink: 0, maxWidth: 132 },

  progBg:   { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },

  emptyBox:   { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  emptyIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyDesc:  { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  emptyBtn:   { backgroundColor: '#1565C0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },

  fab: { position: 'absolute', bottom: 90, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  sheetContent: { paddingBottom: 28 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20, textAlign: 'center' },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  typeBtnExpActive: { backgroundColor: '#EF4444' },
  typeBtnIncActive: { backgroundColor: '#10B981' },
  typeTxt: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },

  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', marginRight: 8 },
  catChipActive: { borderColor: '#1565C0', backgroundColor: '#EFF6FF' },
  catChipIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catChipTxt: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  payList: { gap: 8, marginBottom: 16 },
  payOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  payTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  paySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 12, borderStyle: 'dashed' },
  photoBtnTxt: { fontSize: 14, color: '#6B7280', flex: 1, minWidth: 0 },
  receiptThumb: { width: '100%', height: 100, borderRadius: 12, marginBottom: 8 },
  signBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 16 },
  signBannerTxt: { fontSize: 13, color: '#1E40AF', flex: 1 },
  signatureSafe: { flex: 1, backgroundColor: '#F9FAFB' },
  signatureModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20 },
  signatureModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  signatureModalSub: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  signatureIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  signatureCanvasWrap: { flex: 1, marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  signatureCancelBtn: { marginHorizontal: 16, marginBottom: 18, padding: 14, alignItems: 'center' },
  signatureCancelTxt: { color: '#6B7280', fontSize: 15, fontWeight: '700' },

  saveBtn: { backgroundColor: '#111827', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
