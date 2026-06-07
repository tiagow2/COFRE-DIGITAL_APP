import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { geoLocationService } from '@/services/geoLocationService';
import { geoReminderService, MonitoredLocation, NearbyPlace } from '@/services/geoReminderService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Outros'];
const DEFAULT_KEYWORDS = ['lotérica', 'banco', 'mercado', 'farmácia'];

export default function GeoRemindersScreen() {
  const router = useRouter();
  const theme = useFinancialTheme();
  const [keyword, setKeyword] = useState('lotérica');
  const [category, setCategory] = useState('Moradia');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [locations, setLocations] = useState<MonitoredLocation[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [checkingNearby, setCheckingNearby] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

  const loadLocations = async () => {
    setLoadingLocations(true);
    try {
      const saved = await geoReminderService.listMonitoredLocations();
      setLocations(saved);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível carregar lembretes.');
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleSearch = async () => {
    if (!apiKey) {
      Alert.alert('Google Places', 'Configure EXPO_PUBLIC_GOOGLE_PLACES_API_KEY no arquivo .env.local.');
      return;
    }

    setLoadingPlaces(true);
    try {
      const current = await geoLocationService.getCurrentLocation();
      if (!current) {
        Alert.alert('Localização', 'Permita o acesso à localização para buscar lugares próximos.');
        return;
      }

      const results = await geoReminderService.searchNearbyPlaces(current.lat, current.lng, apiKey, keyword.trim() || 'lotérica');
      setPlaces(results);
      if (results.length === 0) Alert.alert('Busca', 'Nenhum local próximo encontrado para esse termo.');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível buscar locais próximos.');
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleSavePlace = async (place: NearbyPlace) => {
    try {
      await geoReminderService.saveMonitoredLocation(place.placeId, place.name, place.lat, place.lng, category);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadLocations();
      Alert.alert('Salvo', `${place.name} foi salvo para ${category}.`);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível salvar o local.');
    }
  };

  const handleCheckNearby = async () => {
    setCheckingNearby(true);
    try {
      const nearby = await geoReminderService.checkNearbyLocations();
      if (nearby.length === 0) {
        Alert.alert('Locais próximos', 'Você não está perto de nenhum local salvo agora.');
        return;
      }

      Alert.alert(
        'Local salvo por perto',
        nearby.map((item) => `${item.name} - ${item.billCategory}`).join('\n')
      );
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível verificar locais próximos.');
    } finally {
      setCheckingNearby(false);
    }
  };

  const handleToggleLocation = async (item: MonitoredLocation, active: boolean) => {
    await geoReminderService.setLocationActive(item.id, active);
    await loadLocations();
  };

  const handleDeleteLocation = (item: MonitoredLocation) => {
    Alert.alert('Remover local', `Remover ${item.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await geoReminderService.deleteLocation(item.id);
          await loadLocations();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Lembretes por local</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.statusCard, { borderColor: theme.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.cardTitle}>Locais salvos</Text>
            <Text style={s.muted}>Salve lugares importantes e verifique manualmente se você está perto deles.</Text>
          </View>
          <TouchableOpacity style={[s.checkBtn, { backgroundColor: theme.accent }]} onPress={handleCheckNearby} disabled={checkingNearby}>
            {checkingNearby ? <ActivityIndicator color="#fff" /> : <Ionicons name="navigate-outline" size={17} color="#fff" />}
            <Text style={s.checkBtnText}>Verificar</Text>
          </TouchableOpacity>
        </View>

        {!apiKey && (
          <View style={s.warningCard}>
            <Ionicons name="key-outline" size={18} color="#B45309" />
            <Text style={s.warningText}>
              Adicione EXPO_PUBLIC_GOOGLE_PLACES_API_KEY no .env.local para buscar lugares reais pelo Google Places.
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Buscar lugares próximos</Text>
          <Text style={s.label}>Termo</Text>
          <TextInput
            style={s.input}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="lotérica, banco, mercado..."
            placeholderTextColor="#9CA3AF"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.keywordList}>
            {DEFAULT_KEYWORDS.map((item) => (
              <TouchableOpacity key={item} style={[s.chip, keyword === item && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => setKeyword(item)}>
                <Text style={[s.chipText, keyword === item && { color: '#fff' }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Categoria da conta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.keywordList}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity key={item} style={[s.chip, category === item && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => setCategory(item)}>
                <Text style={[s.chipText, category === item && { color: '#fff' }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.accent }]} onPress={handleSearch} disabled={loadingPlaces}>
            {loadingPlaces ? <ActivityIndicator color="#fff" /> : <Ionicons name="search-outline" size={18} color="#fff" />}
            <Text style={s.primaryBtnText}>Buscar com Google Places</Text>
          </TouchableOpacity>
        </View>

        {places.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Resultados</Text>
            {places.map((place) => (
              <TouchableOpacity key={place.placeId} style={s.placeRow} onPress={() => handleSavePlace(place)}>
                <View style={[s.placeIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="location-outline" size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.placeName} numberOfLines={1}>{place.name}</Text>
                  <Text style={s.placeAddress} numberOfLines={1}>{place.address || 'Endereço não informado'}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Locais salvos</Text>
          {loadingLocations ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
          ) : locations.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="map-outline" size={28} color="#9CA3AF" />
              <Text style={s.emptyText}>Nenhum local monitorado ainda.</Text>
            </View>
          ) : (
            locations.map((item) => (
              <View key={item.id} style={s.locationRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.placeName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.placeAddress} numberOfLines={1}>{item.billCategory} • raio de 200m</Text>
                </View>
                <Switch
                  value={item.active}
                  onValueChange={(active) => handleToggleLocation(item, active)}
                  trackColor={{ false: '#E5E7EB', true: theme.accent }}
                  thumbColor="#fff"
                />
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteLocation(item)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
          <Text style={s.infoText}>
            Notificações foram removidas para manter o app funcionando no Expo Go. Use Verificar para conferir locais próximos manualmente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 120 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 14 },
  checkBtn: { minWidth: 104, height: 42, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  checkBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  muted: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 14 },
  warningText: { flex: 1, minWidth: 0, color: '#92400E', fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  keywordList: { gap: 8, paddingRight: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '700' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  placeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  placeAddress: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 13, color: '#6B7280' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deleteBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEF2F7' },
  infoText: { flex: 1, minWidth: 0, color: '#6B7280', fontSize: 12, lineHeight: 18 },
});
