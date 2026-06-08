import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { geoLocationService } from '@/services/geoLocationService';
import { useRegionalComparison } from '@/hooks/useRegionalComparison';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Outros'];
const MIN_USERS = 1;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const safeDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(typeof value === 'string' ? value : new Date().toISOString());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export default function CompareScreen() {
  const { user } = useAuth();
  const { transactions, isOnline } = useFinance();
  const theme = useFinancialTheme();
  const [selectedCategory, setSelectedCategory] = useState('Alimentação');
  const [city, setCity] = useState('');
  const [loadingCity, setLoadingCity] = useState(false);

  const userTransactions = useMemo(() => {
    if (!user?.uid) return [];
    return transactions.filter((t: any) => {
      const ownerId = t.userId ?? t.user_id;
      return !ownerId || ownerId === user.uid;
    });
  }, [transactions, user?.uid]);

  const { currentMonthAmount, pastAverageAmount, categoryCount } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let current = 0;
    let pastTotal = 0;
    let pastMonthsSet = new Set<string>();
    let count = 0;

    userTransactions.forEach((tx: any) => {
      if ((tx.type === 'expense' || tx.type === 'Despesa') && (tx.category || '').trim() === selectedCategory) {
        const date = safeDate(tx.date || tx.createdAt);
        const txMonth = date.getMonth();
        const txYear = date.getFullYear();
        const amt = Number(tx.amount || 0);

        count++;

        if (txMonth === currentMonth && txYear === currentYear) {
          current += amt;
        } else if (date < now) {
          pastTotal += amt;
          pastMonthsSet.add(`${txYear}-${txMonth}`);
        }
      }
    });

    const pastMonthsCount = Math.max(pastMonthsSet.size, 1);
    const pastAverage = pastMonthsSet.size > 0 ? pastTotal / pastMonthsCount : 0;

    return { currentMonthAmount: current, pastAverageAmount: pastAverage, categoryCount: count };
  }, [selectedCategory, userTransactions]);

  const { result, loading: loadingAverage, error } = useRegionalComparison(user?.uid, city, selectedCategory, currentMonthAmount);

  const handleUseLocation = async () => {
    setLoadingCity(true);
    try {
      const nextCity = await geoLocationService.getCurrentCity();
      if (!nextCity || nextCity === 'Desconhecida') {
        Alert.alert('Localização', 'Não consegui identificar sua cidade. Verifique a permissão de localização.');
        return;
      }

      setCity(nextCity);
    } catch {
      Alert.alert('Erro', 'Não foi possível acessar sua localização.');
    } finally {
      setLoadingCity(false);
    }
  };

  const hasFixedSjcData = result?.source === 'fixed_sjc' && result.regionalAverage > 0;
  const hasRegionalData = result && (hasFixedSjcData || result.sampleSize >= MIN_USERS) && result.regionalAverage > 0;
  const hasPastData = pastAverageAmount > 0;
  const hasUserData = categoryCount > 0;
  const estimatedRegionalAverage = hasPastData ? pastAverageAmount : currentMonthAmount;
  const hasEstimatedRegionalData = !hasRegionalData && hasUserData && estimatedRegionalAverage > 0;
  const showComparison = hasRegionalData || hasEstimatedRegionalData;

  const comparisonTarget = hasRegionalData ? result!.regionalAverage : estimatedRegionalAverage;
  const targetLabel = 'Região';
  const targetSub = hasFixedSjcData ? 'Referência SJC' : hasRegionalData ? 'Média regional' : hasPastData ? 'Estimativa pelo histórico' : 'Primeira amostra local';
  const regionalSamplesLabel = hasRegionalData
    ? hasFixedSjcData
      ? 'referência SJC'
      : `${result?.sampleSize} ${result?.sampleSize === 1 ? 'amostra' : 'amostras'}`
    : hasEstimatedRegionalData
      ? 'estimativa'
      : '';

  const diffAmt = currentMonthAmount - comparisonTarget;
  const diffPct = comparisonTarget > 0 ? (diffAmt / comparisonTarget) * 100 : 0;
  let fallbackStatus: 'above_average' | 'below_average' | 'within_average' = 'within_average';
  if (diffPct > 10) fallbackStatus = 'above_average';
  else if (diffPct < -10) fallbackStatus = 'below_average';

  const finalStatus = hasRegionalData ? result?.status : fallbackStatus;
  const finalDiffAmt = hasRegionalData ? result?.differenceAmount : diffAmt;
  const finalDiffPct = hasRegionalData ? result?.differencePercentage : diffPct;

  const maxBarValue = Math.max(currentMonthAmount, comparisonTarget, 1);
  const userBarWidth = `${Math.max((currentMonthAmount / maxBarValue) * 100, 5)}%`;
  const targetBarWidth = `${Math.max((comparisonTarget / maxBarValue) * 100, 5)}%`;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <View style={s.topBar}>
        <Text style={s.title}>Média da Região</Text>
        <TouchableOpacity style={s.citySelector} onPress={handleUseLocation} disabled={loadingCity}>
          {loadingCity ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Ionicons name="location" size={16} color={theme.accent} />
          )}
          <Text style={[s.cityText, { color: theme.accent }]} numberOfLines={1}>
            {city || 'Definir localização'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryList}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.catChip, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[s.catTxt, active && { color: '#fff' }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {!city ? (
          <View style={s.cardBlock}>
            <View style={s.emptyBox}>
              <Ionicons name="location-outline" size={24} color="#9CA3AF" />
              <Text style={s.emptyTitle}>Descubra sua região</Text>
              <Text style={s.emptyText}>Permita o acesso à localização para comparar seus gastos.</Text>
            </View>
          </View>
        ) : error ? (
          <View style={s.cardBlock}>
            <View style={s.warningBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
              <Text style={s.warningText}>{error}</Text>
            </View>
          </View>
        ) : loadingAverage ? (
          <View style={s.cardBlock}>
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 40 }} />
          </View>
        ) : (!showComparison && !hasUserData) ? (
          <View style={s.cardBlock}>
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={24} color="#9CA3AF" />
              <Text style={s.emptyTitle}>Dados insuficientes</Text>
              <Text style={s.emptyText}>Sem histórico ou dados regionais para esta categoria.</Text>
            </View>
          </View>
        ) : (showComparison || hasUserData) ? (
          <View style={s.mainCard}>
            <View style={s.cardHeader}>
              <Text style={s.cardCategory}>{selectedCategory}</Text>
              {(hasRegionalData || hasEstimatedRegionalData) && (
                <View style={s.badge}>
                <Ionicons name="people" size={12} color="#6B7280" />
                  <Text style={s.badgeTxt}>{regionalSamplesLabel}</Text>
                </View>
              )}
            </View>

            <View style={s.barsContainer}>
              <View style={s.barRow}>
                <View style={s.barLabelContainer}>
                  <Text style={s.barLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Você</Text>
                  <Text style={s.barSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    {categoryCount} {categoryCount === 1 ? 'transação' : 'transações'}
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: userBarWidth as any, backgroundColor: finalStatus === 'above_average' ? '#EF4444' : theme.accent }]} />
                </View>
                <Text style={s.barValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(currentMonthAmount)}</Text>
              </View>

              {showComparison ? (
              <View style={s.barRow}>
                <View style={s.barLabelContainer}>
                  <Text style={s.barLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{targetLabel}</Text>
                  <Text style={s.barSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{targetSub}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: targetBarWidth as any, backgroundColor: '#E5E7EB' }]} />
                </View>
                <Text style={s.barValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(comparisonTarget)}</Text>
              </View>
              ) : (
                <View style={[s.barRow, { paddingVertical: 10, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', textAlign: 'center' }}>Seu histórico foi encontrado. A média regional aparece assim que a contribuição anônima desta categoria for registrada.</Text>
                </View>
              )}
            </View>

            {showComparison && (
              <>
            <View style={s.divider} />

            <View style={s.resultFooter}>
              <View style={[s.iconWrap, { backgroundColor: finalStatus === 'above_average' ? '#FEE2E2' : finalStatus === 'below_average' ? '#D1FAE5' : '#F3F4F6' }]}>
                <Ionicons 
                  name={finalStatus === 'above_average' ? 'warning' : finalStatus === 'below_average' ? 'trending-down' : 'checkmark-circle'} 
                  size={22} 
                  color={finalStatus === 'above_average' ? '#EF4444' : finalStatus === 'below_average' ? '#10B981' : '#4B5563'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.resultTitle, { color: finalStatus === 'above_average' ? '#991B1B' : finalStatus === 'below_average' ? '#065F46' : '#374151' }]}>
                  {finalStatus === 'above_average' ? `${Math.abs(finalDiffPct || 0).toFixed(1)}% acima da média` :
                   finalStatus === 'below_average' ? `${Math.abs(finalDiffPct || 0).toFixed(1)}% abaixo da média` :
                   'Dentro da média esperada'}
                </Text>
                <Text style={s.resultDesc}>A diferença é de {fmt(Math.abs(finalDiffAmt || 0))}</Text>
              </View>
            </View>
              </>
            )}
          </View>
        ) : null}

        <View style={s.infoCard}>
          <Ionicons name="shield-checkmark" size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>Privacidade Garantida</Text>
          <Text style={s.infoText}>
              Comparações baseadas em dados 100% anônimos. Sua identidade e transações exatas nunca são expostas.
          </Text>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  citySelector: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  cityText: { fontSize: 13, fontWeight: '700', maxWidth: 100 },
  tabsWrapper: { paddingLeft: 20, paddingBottom: 16 },
  categoryList: { gap: 8, paddingRight: 40 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  catTxt: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  content: { paddingBottom: 120 },
  cardBlock: { paddingHorizontal: 20 },
  mainCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#EEF2F7', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 24 },
  cardCategory: { fontSize: 16, fontWeight: '800', color: '#111827' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  badgeTxt: { fontSize: 11, color: '#4B5563', fontWeight: '700' },
  barsContainer: { gap: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabelContainer: { width: 92, flexShrink: 0 },
  barLabel: { fontSize: 13, color: '#111827', fontWeight: '700' },
  barSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  barTrack: { flex: 1, minWidth: 48, height: 12, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barValue: { width: 92, flexShrink: 0, fontSize: 12, fontWeight: '800', color: '#111827', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  resultFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  resultDesc: { fontSize: 12, color: '#6B7280' },
  emptyBox: { alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EEF2F7' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginTop: 8 },
  emptyText: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 4, textAlign: 'center' },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  warningText: { flex: 1, minWidth: 0, color: '#92400E', fontSize: 13, lineHeight: 18 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, marginTop: 20, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#15803D', lineHeight: 18 },
});
