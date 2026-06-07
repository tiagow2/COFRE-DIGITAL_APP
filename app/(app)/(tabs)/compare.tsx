import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { geoLocationService } from '@/services/geoLocationService';
import { RegionalAverage, regionalComparisonService } from '@/services/regionalComparisonService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Outros'];
const MIN_USERS = 2;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CompareScreen() {
  const { user } = useAuth();
  const { transactions, isOnline } = useFinance();
  const theme = useFinancialTheme();
  const [selectedCategory, setSelectedCategory] = useState('Alimentação');
  const [city, setCity] = useState('');
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingAverage, setLoadingAverage] = useState(false);
  const [average, setAverage] = useState<RegionalAverage | null>(null);
  const [error, setError] = useState('');

  const yourMonthlyExpense = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((tx) => {
        const date = new Date(tx.date);
        return (
          tx.type === 'expense' &&
          tx.category === selectedCategory &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((total, tx) => total + tx.amount, 0);
  }, [selectedCategory, transactions]);

  const categoryCount = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const date = new Date(tx.date);
      return (
        tx.type === 'expense' &&
        tx.category === selectedCategory &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [selectedCategory, transactions]);

  useEffect(() => {
    if (!user?.uid || !city) return;

    let active = true;
    const loadAverage = async () => {
      setLoadingAverage(true);
      setError('');
      try {
        const data = await regionalComparisonService.fetchAverage(user.uid, city, selectedCategory);
        if (active) setAverage(data);
      } catch {
        if (active) {
          setAverage(null);
          setError('Não foi possível buscar a média regional agora.');
        }
      } finally {
        if (active) setLoadingAverage(false);
      }
    };

    loadAverage();
    return () => { active = false; };
  }, [city, selectedCategory, user?.uid]);

  const handleUseLocation = async () => {
    if (!user?.uid) return;

    setLoadingCity(true);
    setError('');
    try {
      const nextCity = await geoLocationService.getCurrentCity();
      if (!nextCity || nextCity === 'Desconhecida') {
        Alert.alert('Localização', 'Não consegui identificar sua cidade. Verifique a permissão de localização.');
        return;
      }

      setCity(nextCity);
      await regionalComparisonService.registerCity(user.uid, nextCity);
    } catch {
      setError('Não foi possível acessar sua localização.');
    } finally {
      setLoadingCity(false);
    }
  };

  const hasRegionalData = !!average && average.userCount >= MIN_USERS && average.avgExpense > 0;
  const difference = hasRegionalData ? yourMonthlyExpense - average.avgExpense : 0;
  const above = difference > 0;
  const percent = hasRegionalData && average.avgExpense > 0
    ? Math.abs((difference / average.avgExpense) * 100)
    : 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <LinearGradient colors={[theme.accent, theme.accentDark]} style={s.header}>
          <View style={s.headerTop}>
            <Text style={s.title} numberOfLines={1}>Comparação regional</Text>
            <View style={s.statusPill}>
              <View style={[s.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#EF4444' }]} />
              <Text style={s.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <Text style={s.subtitle}>
            Compare seus gastos com médias anônimas da sua cidade.
          </Text>
        </LinearGradient>

        <View style={s.card}>
          <View style={s.locationHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.cardTitle}>Cidade</Text>
              <Text style={s.muted} numberOfLines={1}>{city || 'Nenhuma cidade definida'}</Text>
            </View>
            <TouchableOpacity style={[s.locationBtn, { backgroundColor: theme.accent }]} onPress={handleUseLocation} disabled={loadingCity}>
              {loadingCity ? <ActivityIndicator color="#fff" /> : <Ionicons name="location-outline" size={17} color="#fff" />}
              <Text style={s.locationBtnText}>Usar local</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.categoryBlock}>
          <Text style={s.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryList}>
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[s.categoryButton, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[s.categoryButtonText, active && s.categoryButtonTextActive]} numberOfLines={1}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.compareCard}>
          <Text style={s.cardTitle}>{selectedCategory}</Text>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Seu gasto no mês</Text>
              <Text style={[s.statValue, { color: theme.accent }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(yourMonthlyExpense)}</Text>
              <Text style={s.statCount}>{categoryCount} transações</Text>
            </View>
            <View style={s.divider} />
            <View style={s.stat}>
              <Text style={s.statLabel}>Média regional</Text>
              {loadingAverage ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />
              ) : (
                <>
                  <Text style={[s.statValue, { color: hasRegionalData ? theme.accent : '#9CA3AF' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {hasRegionalData ? fmt(average.avgExpense) : '--'}
                  </Text>
                  <Text style={s.statCount}>{average?.userCount ?? 0} usuários</Text>
                </>
              )}
            </View>
          </View>

          {!city ? (
            <View style={s.emptyBox}>
              <Ionicons name="location-outline" size={24} color="#9CA3AF" />
              <Text style={s.emptyTitle}>Informe sua cidade</Text>
              <Text style={s.emptyText}>Use a localização para buscar médias anônimas da sua região.</Text>
            </View>
          ) : error ? (
            <View style={s.warningBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
              <Text style={s.warningText}>{error}</Text>
            </View>
          ) : !loadingAverage && !hasRegionalData ? (
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={24} color="#9CA3AF" />
              <Text style={s.emptyTitle}>Dados insuficientes</Text>
              <Text style={s.emptyText}>Ainda não há dados anônimos suficientes para comparar {selectedCategory} em {city}.</Text>
            </View>
          ) : hasRegionalData ? (
            <View style={[s.resultBox, { backgroundColor: above ? '#FEF2F2' : '#F0FDF4' }]}>
              <Ionicons name={above ? 'trending-up-outline' : 'trending-down-outline'} size={22} color={above ? '#DC2626' : '#059669'} />
              <Text style={s.resultText}>
                Você está {percent.toFixed(1)}% {above ? 'acima' : 'abaixo'} da média regional.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.infoCard}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.accent} />
          <Text style={s.infoText}>
            A comparação usa dados agregados. Quando houver poucos usuários na cidade/categoria, o app não mostra média.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingBottom: 120 },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { marginTop: 8, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.82)' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  card: { marginHorizontal: 20, marginTop: 18, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#EEF2F7' },
  locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  muted: { fontSize: 13, color: '#6B7280' },
  locationBtn: { minWidth: 112, height: 42, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  locationBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  categoryBlock: { paddingHorizontal: 20, paddingTop: 18 },
  label: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 10 },
  categoryList: { gap: 8, paddingRight: 20 },
  categoryButton: { maxWidth: 156, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  categoryButtonText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  categoryButtonTextActive: { color: '#fff' },
  compareCard: { marginHorizontal: 20, marginTop: 18, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#EEF2F7' },
  statsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginTop: 12, marginBottom: 18 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, backgroundColor: '#EEF2F7' },
  statLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', minWidth: 0, maxWidth: '100%' },
  statCount: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  emptyBox: { alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EEF2F7' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginTop: 8 },
  emptyText: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 4, textAlign: 'center' },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  warningText: { flex: 1, minWidth: 0, color: '#92400E', fontSize: 13, lineHeight: 18 },
  resultBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16 },
  resultText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', color: '#111827' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, marginTop: 18, padding: 16, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#EEF2F7' },
  infoText: { flex: 1, minWidth: 0, fontSize: 12, color: '#6B7280', lineHeight: 18 },
});
