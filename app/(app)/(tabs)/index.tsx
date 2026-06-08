import { SignaturePad } from '@/components/DigitalSignature';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { profileService } from '@/services/profileService';
import { compareSignatures } from '@/services/signatureValidation';
import { buildCardLimitNotifications } from '@/utils/cardLimits';
import { parseCurrencyInput } from '@/utils/currency';
import { normalizeSignatureValue } from '@/utils/signatureData';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = [
  { name: 'Alimentação', icon: 'restaurant-outline', bg: '#FEF3C7', color: '#D97706' },
  { name: 'Transporte', icon: 'car-outline', bg: '#D1FAE5', color: '#059669' },
  { name: 'Lazer', icon: 'game-controller-outline', bg: '#FCE7F3', color: '#DB2777' },
  { name: 'Saúde', icon: 'medical-outline', bg: '#DCFCE7', color: '#16A34A' },
  { name: 'Moradia', icon: 'home-outline', bg: '#DBEAFE', color: '#2563EB' },
  { name: 'Educação', icon: 'book-outline', bg: '#EDE9FE', color: '#7C3AED' },
  { name: 'Outros', icon: 'ellipsis-horizontal-outline', bg: '#F3F4F6', color: '#4B5563' },
];

const HIGH_VALUE = 5000;
const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const {
    transactions,
    challenges,
    addTransaction,
    suggestCategory,
    loadingData,
    creditCards,
    getCardLimitStatus,
    canUseCardForTransaction,
  } = useFinance();
  const theme = useFinancialTheme();
  const router = useRouter();

  const [modal, setModal] = useState(false);
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'credit_card'>('balance');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [profileSignature, setProfileSignature] = useState<string | undefined>();
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [signModal, setSignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validatingSignature, setValidatingSignature] = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  const userTransactions = useMemo(() => {
    if (!user?.uid) return [];
    return transactions.filter((t: any) => t.userId === user.uid || t.user_id === user.uid);
  }, [transactions, user?.uid]);

  const userCards = useMemo(() => {
    if (!user?.uid) return [];
    return creditCards.filter((c: any) => c.userId === user.uid || c.user_id === user.uid);
  }, [creditCards, user?.uid]);

  const userChallenges = useMemo(() => {
    if (!user?.uid) return [];
    return challenges.filter((c: any) => c.userId === user.uid || c.user_id === user.uid);
  }, [challenges, user?.uid]);

  const recent = userTransactions.slice(0, 5);

  const balance = useMemo(() => {
    const inc = userTransactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + asNumber(t.amount), 0);
    const exp = userTransactions.filter((t: any) => t.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance')).reduce((sum: number, t: any) => sum + asNumber(t.amount), 0);
    return inc - exp;
  }, [userTransactions]);

  const monthlyIncome = useMemo(() => {
    const now = new Date();
    return userTransactions.filter((t: any) => t.type === 'income' && new Date(t.date || t.createdAt).getMonth() === now.getMonth() && new Date(t.date || t.createdAt).getFullYear() === now.getFullYear()).reduce((sum: number, t: any) => sum + asNumber(t.amount), 0);
  }, [userTransactions]);

  const monthlyAccountExpenses = useMemo(() => {
    const now = new Date();
    return userTransactions.filter((t: any) => t.type === 'expense' && (!t.paymentMethod || t.paymentMethod === 'balance') && new Date(t.date || t.createdAt).getMonth() === now.getMonth() && new Date(t.date || t.createdAt).getFullYear() === now.getFullYear()).reduce((sum: number, t: any) => sum + asNumber(t.amount), 0);
  }, [userTransactions]);

  const monthlyCardExpenses = useMemo(() => {
    const now = new Date();
    return userTransactions.filter((t: any) => t.type === 'expense' && t.paymentMethod === 'credit_card' && new Date(t.date || t.createdAt).getMonth() === now.getMonth() && new Date(t.date || t.createdAt).getFullYear() === now.getFullYear()).reduce((sum: number, t: any) => sum + asNumber(t.amount), 0);
  }, [userTransactions]);

  const activeChallenges = userChallenges.filter((challenge: any) => challenge.status === 'active').slice(0, 2);
  const selectedCard = userCards.find((card: any) => card.id === selectedCardId);
  const cardNotifications = useMemo(
    () => buildCardLimitNotifications(userCards, user?.uid ?? 'local'),
    [userCards, user?.uid]
  );

  useEffect(() => {
    if (!user?.uid) {
      setProfileSignature(undefined);
      setProfilePhoto(undefined);
      return;
    }

    profileService.load(user.uid).then((profile) => {
      setProfileSignature(profile?.signature ? normalizeSignatureValue(profile.signature) : undefined);
      setProfilePhoto(profile?.photoUri);
    });
  }, [user?.uid, modal]);

  const resetTransactionForm = () => {
    setDesc('');
    setAmount('');
    setReceiptPhoto(null);
    setTxType('expense');
    setCategory('Alimentação');
    setPaymentMethod('balance');
    setSelectedCardId('');
  };

  const loadSavedSignature = async () => {
    if (!user?.uid) return undefined;
    const profile = await profileService.load(user.uid);
    const savedSignature = profile?.signature ? normalizeSignatureValue(profile.signature) : undefined;
    setProfileSignature(savedSignature);
    setProfilePhoto(profile?.photoUri);
    return savedSignature;
  };

  const handleDescChange = (text: string) => {
    setDesc(text);
    if (text.length > 2) setCategory(suggestCategory(text));
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita acesso à câmera para fotografar comprovantes.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setReceiptPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    const value = parseCurrencyInput(amount);
    if (loadingData) {
      Alert.alert('Aguarde', 'Seus dados ainda estão carregando.');
      return;
    }
    if (!desc.trim()) {
      Alert.alert('Erro', 'Informe a descrição.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Erro', 'Informe um valor válido.');
      return;
    }

    if (txType === 'expense' && paymentMethod === 'credit_card') {
      if (!selectedCard) {
        Alert.alert('Escolha um cartão', 'Selecione o cartão usado nessa despesa.');
        return;
      }

      const cardUse = canUseCardForTransaction(selectedCard.id, value);
      if (!cardUse.ok) {
        Alert.alert(
          'Limite insuficiente',
          `Essa compra ultrapassa o limite disponível do cartão. Disponível agora: ${fmt(cardUse.available)}.`
        );
        return;
      }
    }

    if (txType === 'expense' && value >= HIGH_VALUE) {
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

    await doSave(value);
  };

  const doSave = async (value: number, signature?: string, signatureScore = 0) => {
    if (saving) return;
    setSaving(true);
    try {
      const savedCategory = txType === 'income' ? 'Receita' : category;
      const cat = CATEGORIES.find((item) => item.name === savedCategory);

      await addTransaction({
        type: txType,
        description: desc.trim(),
        amount: value,
        category: savedCategory,
        icon: txType === 'income' ? 'wallet-outline' : cat?.icon ?? 'ellipsis-horizontal-outline',
        paymentMethod: txType === 'expense' ? paymentMethod : 'balance',
        creditCardId: txType === 'expense' && paymentMethod === 'credit_card' ? selectedCard?.id : undefined,
        creditCardName: txType === 'expense' && paymentMethod === 'credit_card' ? selectedCard?.name : undefined,
        signatureRequired: txType === 'expense' && value >= HIGH_VALUE,
        signatureApproved: txType === 'expense' && value >= HIGH_VALUE ? !!signature : false,
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

  const handleSignOK = async (signature: string) => {
    const savedSignature = profileSignature || await loadSavedSignature();
    if (!savedSignature) {
      closeSignModal();
      Alert.alert('Assinatura não cadastrada', 'Cadastre uma assinatura no perfil para confirmar transações de alto valor.');
      return;
    }

    const candidateSignature = normalizeSignatureValue(signature);
    if (!candidateSignature) {
      setValidatingSignature(false);
      Alert.alert('Assinatura vazia', 'Assine antes de confirmar.');
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
    await doSave(parseCurrencyInput(amount), candidateSignature, result.score);
    setValidatingSignature(false);
  };

  const catInfo = (tx: any) => {
    const info = CATEGORIES.find((item) => item.name === tx.category);
    return tx.type === 'income'
      ? { icon: 'arrow-up-circle-outline', bg: '#D1FAE5', color: '#059669' }
      : { icon: info?.icon ?? 'ellipsis-horizontal-outline', bg: info?.bg ?? '#F3F4F6', color: info?.color ?? '#4B5563' };
  };

  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text style={s.greeting} numberOfLines={1}>{greeting}, {firstName}</Text>
            <Text style={s.subtitle} numberOfLines={1}>Veja como está seu cofre hoje</Text>
          </View>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/(tabs)/settings' as never);
            }}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={s.headerAvatar} />
            ) : (
              <Ionicons name="person-circle-outline" size={25} color="#374151" />
            )}
          </TouchableOpacity>
        </View>

        <LinearGradient colors={[theme.accent, theme.accentDark]} style={[s.balanceCard, { shadowColor: theme.accent }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.balanceLabel}>Saldo disponível</Text>
          <Text style={s.balanceValue} adjustsFontSizeToFit numberOfLines={1}>{fmt(balance)}</Text>
          <View style={s.balanceRow}>
            <BalanceItem icon="trending-up-outline" label="Receitas" value={fmt(monthlyIncome)} />
            <View style={s.balanceDivider} />
            <BalanceItem icon="wallet-outline" label="Conta" value={fmt(monthlyAccountExpenses)} />
            <View style={s.balanceDivider} />
            <BalanceItem icon="card-outline" label="Cartão" value={fmt(monthlyCardExpenses)} />
          </View>
        </LinearGradient>

        <View style={s.quickActions}>
          {[
            { label: 'Adicionar', icon: 'add-circle-outline', color: theme.accent, bg: theme.accentSoft, action: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModal(true); } },
            { label: 'Cartões', icon: 'card-outline', color: '#7C3AED', bg: '#F5F3FF', action: () => router.push('/(app)/(tabs)/credit-cards' as never) },
            { label: 'Boleto', icon: 'barcode-outline', color: '#D97706', bg: '#FFFBEB', action: () => router.push('/(app)/(tabs)/boleto-scanner' as never) },
            { label: 'Simulador', icon: 'calculator-outline', color: '#059669', bg: '#F0FDF4', action: () => router.push('/(app)/(tabs)/simulator' as never) },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={s.quickBtn} onPress={action.action} activeOpacity={0.75}>
              <View style={[s.quickIcon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={s.quickLabel} numberOfLines={1}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cardNotifications.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <View style={s.sectionHeaderLeft}>
                <Ionicons name="card" size={18} color={theme.accent} />
                <Text style={s.sectionTitle}>Alertas dos cartões</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/credit-cards' as never)}>
                <Text style={[s.seeAll, { color: theme.accent }]}>Gerenciar</Text>
              </TouchableOpacity>
            </View>
            {cardNotifications.slice(0, 3).map((item: any) => {
              const card = userCards.find((cardItem: any) => cardItem.id === item.relatedCardId);
              const status = card ? getCardLimitStatus(card.id) : undefined;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.alertCard, { backgroundColor: status?.softColor ?? '#FFFBEB', borderColor: status?.color ?? '#FDE68A' }]}
                  onPress={() => router.push('/(app)/(tabs)/credit-cards' as never)}
                  activeOpacity={0.8}
                >
                  <View style={s.alertIcon}>
                    <Ionicons name="card-outline" size={18} color={status?.color ?? '#D97706'} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.alertHeader}>
                      <Text style={s.alertName} numberOfLines={1}>{item.title}</Text>
                      {status && <Text style={[s.alertPct, { color: status.color }]}>{status.percentage}%</Text>}
                    </View>
                    <Text style={s.alertSub}>{item.message}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {activeChallenges.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <View style={s.sectionHeaderLeft}>
                <Ionicons name="trophy" size={18} color={theme.accent} />
                <Text style={s.sectionTitle}>Desafios ativos</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/challenges' as never)}>
                <Text style={[s.seeAll, { color: theme.accent }]}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.challengeList}>
              {activeChallenges.map((challenge: any) => {
                const pct = Math.min(Math.round((challenge.currentAmount / challenge.targetAmount) * 100), 100);
                return (
                  <View key={challenge.id} style={s.challengeCard}>
                    <Ionicons name="trophy-outline" size={26} color="#D97706" />
                    <Text style={s.challengeTitle} numberOfLines={1}>{challenge.title}</Text>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: '#F59E0B' }]} />
                    </View>
                    <Text style={s.challengeSub}>{fmt(challenge.currentAmount)} / {fmt(challenge.targetAmount)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={s.sectionRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="receipt" size={18} color={theme.accent} />
            <Text style={s.sectionTitle}>Transações recentes</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/extrato' as never)}>
            <Text style={[s.seeAll, { color: theme.accent }]}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconBg}>
              <Ionicons name="receipt-outline" size={28} color="#9CA3AF" />
            </View>
            <Text style={s.emptyTitle}>Nenhuma transação</Text>
            <Text style={s.emptyDesc}>Registre sua primeira receita ou despesa.</Text>
            <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setModal(true)}>
              <Text style={s.emptyBtnTxt}>Adicionar transação</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.txCard}>
            {recent.map((tx: any, index) => {
              const info = catInfo(tx);
              return (
                <View key={tx.id} style={[s.txRow, index === recent.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.txIcon, { backgroundColor: info.bg }]}>
                    <Ionicons name={info.icon as any} size={18} color={info.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={s.txCat} numberOfLines={1}>{tx.creditCardName ? `${tx.category} - ${tx.creditCardName}` : tx.category}</Text>
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

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setModal(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModal(false)}>
            <TouchableOpacity activeOpacity={1} style={s.sheet}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>Nova transação</Text>

                <View style={s.typeRow}>
                  {(['expense', 'income'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[s.typeBtn, txType === type && (type === 'expense' ? s.typeBtnExpActive : s.typeBtnIncActive)]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTxType(type);
                        if (type === 'income') {
                          setPaymentMethod('balance');
                          setSelectedCardId('');
                        }
                      }}
                    >
                      <Ionicons name={type === 'expense' ? 'arrow-up' : 'arrow-down'} size={14} color={txType === type ? '#fff' : '#6B7280'} />
                      <Text style={[s.typeTxt, txType === type && { color: '#fff' }]}>{type === 'expense' ? 'Despesa' : 'Receita'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>Descrição</Text>
                <TextInput style={s.input} placeholder="Ex: Supermercado, salário..." placeholderTextColor="#9CA3AF" value={desc} onChangeText={handleDescChange} />

                <Text style={s.fieldLabel}>Valor (R$)</Text>
                <TextInput style={s.input} placeholder="0,00" placeholderTextColor="#9CA3AF" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

                {txType === 'expense' && (
                  <>
                    <Text style={s.fieldLabel}>Categoria</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {CATEGORIES.map((item) => (
                        <TouchableOpacity key={item.name} style={[s.catChip, category === item.name && s.catChipActive]} onPress={() => { Haptics.selectionAsync(); setCategory(item.name); }}>
                          <View style={[s.catChipIcon, { backgroundColor: item.bg }]}>
                            <Ionicons name={item.icon as any} size={14} color={item.color} />
                          </View>
                          <Text style={[s.catChipTxt, category === item.name && { color: theme.accent, fontWeight: '800' }]}>{item.name}</Text>
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

                      {userCards.map((card: any) => {
                        const status = getCardLimitStatus(card.id);
                        const active = paymentMethod === 'credit_card' && selectedCardId === card.id;
                        return (
                          <TouchableOpacity
                            key={card.id}
                            style={[s.payOption, status.level !== 'ok' && { borderColor: status.color }, active && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                            onPress={() => { setPaymentMethod('credit_card'); setSelectedCardId(card.id); }}
                          >
                            <Ionicons name="card-outline" size={18} color={active ? theme.accent : status.color} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[s.payTitle, active && { color: theme.accent }]} numberOfLines={1}>{card.name}</Text>
                              <Text style={s.paySub} numberOfLines={1}>{fmt(status.available)} disponível na fatura • {status.label}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto}>
                      <Ionicons name="camera-outline" size={18} color={receiptPhoto ? '#059669' : '#6B7280'} />
                      <Text style={[s.photoBtnTxt, receiptPhoto && { color: '#059669' }]}>
                        {receiptPhoto ? 'Comprovante anexado' : 'Fotografar comprovante (opcional)'}
                      </Text>
                    </TouchableOpacity>
                    {receiptPhoto && <Image source={{ uri: receiptPhoto }} style={s.receiptThumb} resizeMode="cover" />}

                    {parseCurrencyInput(amount) >= HIGH_VALUE && (
                      <View style={s.signBanner}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={theme.accent} />
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

      <Modal visible={signModal} animationType="slide" onRequestClose={closeSignModal}>
        <SafeAreaView style={s.signatureSafe}>
          <View style={s.signatureModalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.signatureModalTitle}>Assinatura digital</Text>
              <Text style={s.signatureModalSub}>Transação de alto valor: assine novamente para validar com a assinatura salva no perfil.</Text>
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

function BalanceItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.balanceItem}>
      <Ionicons name={icon as any} size={16} color="rgba(255,255,255,0.7)" />
      <View style={{ marginLeft: 6, flex: 1, minWidth: 0 }}>
        <Text style={s.balanceItemLabel}>{label}</Text>
        <Text style={s.balanceItemValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  greeting: { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 0 },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2, minWidth: 0 },
  profileBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  headerAvatar: { width: '100%', height: '100%', borderRadius: 22 },
  balanceCard: { marginHorizontal: 20, borderRadius: 28, padding: 24, marginBottom: 20, shadowColor: '#1565C0', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginBottom: 20, letterSpacing: 0 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  balanceDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  balanceItemLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  balanceItemValue: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2, minWidth: 0 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginHorizontal: 20, marginBottom: 28 },
  quickBtn: { alignItems: 'center', flex: 1, minWidth: 0 },
  quickIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  quickLabel: { fontSize: 11, color: '#374151', fontWeight: '700', maxWidth: '100%' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16, marginTop: 8 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0 },
  seeAll: { fontSize: 13, color: '#1565C0', fontWeight: '700', flexShrink: 0 },
  alertCard: { marginHorizontal: 20, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  alertIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.62)', alignItems: 'center', justifyContent: 'center' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  alertName: { fontSize: 14, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0 },
  alertPct: { fontSize: 14, fontWeight: '800', flexShrink: 0 },
  alertSub: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  challengeList: { paddingHorizontal: 20, gap: 12 },
  challengeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, width: 160, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  challengeTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 10 },
  challengeSub: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  txCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  txIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontWeight: '700', color: '#111827', minWidth: 0 },
  txCat: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '800', flexShrink: 0, maxWidth: 132 },
  emptyBox: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1.5, borderColor: '#EEF2F7', borderStyle: 'dashed' },
  emptyIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  fab: { position: 'absolute', bottom: 90, right: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  sheetContent: { paddingBottom: 28 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20, textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  typeBtnExpActive: { backgroundColor: '#EF4444' },
  typeBtnIncActive: { backgroundColor: '#10B981' },
  typeTxt: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', marginRight: 8 },
  catChipActive: { borderColor: '#1565C0', backgroundColor: '#EFF6FF' },
  catChipIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catChipTxt: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  payList: { gap: 8, marginBottom: 16 },
  payOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  payTitle: { fontSize: 14, fontWeight: '800', color: '#374151' },
  paySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 12, borderStyle: 'dashed' },
  photoBtnTxt: { fontSize: 14, color: '#6B7280', flex: 1, minWidth: 0 },
  receiptThumb: { width: '100%', height: 100, borderRadius: 12, marginBottom: 8 },
  signBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 16 },
  signBannerTxt: { fontSize: 13, color: '#1E40AF', flex: 1 },
  saveBtn: { borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  signatureSafe: { flex: 1, backgroundColor: '#F9FAFB' },
  signatureModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20 },
  signatureModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  signatureModalSub: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  signatureIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  signatureCanvasWrap: { flex: 1, marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  signatureCancelBtn: { marginHorizontal: 16, marginBottom: 18, padding: 14, alignItems: 'center' },
  signatureCancelTxt: { color: '#6B7280', fontSize: 15, fontWeight: '800' },
});
