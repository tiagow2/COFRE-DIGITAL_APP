import { useAuth } from '@/context/AuthContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { geoLocationService } from '@/services/geoLocationService';
import { distanceMeters, geoReminderService, MonitoredLocation } from '@/services/geoReminderService';
import { placesService, PlaceResult } from '@/services/placesService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Outros'];
const DEFAULT_KEYWORDS = ['lotérica', 'banco', 'farmácia', 'mercado'];

type PendingBill = {
  id: string;
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  status: 'pending' | 'paid';
};

type InternalAlert = {
  placeName: string;
  category: string;
  distance: number;
  bills: PendingBill[];
};

export default function GeoRemindersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useFinancialTheme();

  // Estados de Localização e Interface
  const [locationState, setLocationState] = useState<'pending' | 'granted' | 'denied' | 'error'>('pending');
  const [currentCity, setCurrentCity] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);

  // Estados de Dados
  const [keyword, setKeyword] = useState('lotérica');
  const [category, setCategory] = useState('Moradia');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [locations, setLocations] = useState<MonitoredLocation[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<InternalAlert[]>([]);

  // Estados de Carregamento
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // MOCK TEMPORÁRIO: Contas pendentes simuladas para teste do alerta
  // Substituir por consulta ao repositório real ou backend no futuro.
  const getPendingBillsMock = useCallback((targetCategory: string): PendingBill[] => {
    const allMockBills: PendingBill[] = [
      { id: '1', description: 'Conta de Luz', amount: 145.9, category: 'Moradia', dueDate: '2026-06-10', status: 'pending' },
      { id: '2', description: 'Boleto Faculdade', amount: 890.0, category: 'Educação', dueDate: '2026-06-15', status: 'pending' },
      { id: '3', description: 'Fatura Cartão', amount: 450.0, category: 'Outros', dueDate: '2026-06-12', status: 'pending' },
      { id: '4', description: 'Plano de Saúde', amount: 320.0, category: 'Saúde', dueDate: '2026-06-18', status: 'pending' },
    ];
    return allMockBills.filter((b) => b.category === targetCategory);
  }, []);

  const loadLocations = async () => {
    if (!user?.uid) return [];
    setLoadingLocations(true);
    try {
      const saved = await geoReminderService.listMonitoredLocations(user?.uid);
      setLocations(saved);
      return saved;
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível carregar lembretes.');
      return [];
    } finally {
      setLoadingLocations(false);
    }
  };

  const refreshEnvironment = async () => {
    setIsRefreshing(true);
    try {
      const granted = await geoLocationService.requestPermission();
      if (!granted) {
        setLocationState('denied');
        setIsRefreshing(false);
        return;
      }

      const loc = await geoLocationService.getCurrentLocation();
      if (!loc) {
        setLocationState('error');
        setIsRefreshing(false);
        return;
      }

      setCoords(loc);
      setLocationState('granted');

      const city = await geoLocationService.getCurrentCity();
      setCurrentCity(city);

      const savedLocations = await loadLocations();
      checkInternalAlerts(loc.lat, loc.lng, savedLocations);
    } catch (err) {
      setLocationState('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshEnvironment();
  }, []);

  const checkInternalAlerts = (lat: number, lng: number, monitored: MonitoredLocation[]) => {
    const alerts: InternalAlert[] = [];
    
    monitored.forEach((loc) => {
      if (!loc.active) return;
      
      const dist = distanceMeters(lat, lng, loc.lat, loc.lng);
      // Raio de proximidade fixo em 200m (pode ser tornado dinâmico na entidade)
      if (dist <= 200) {
        const bills = getPendingBillsMock(loc.billCategory);
        if (bills.length > 0) {
          alerts.push({ placeName: loc.name, category: loc.billCategory, distance: Math.round(dist), bills });
        }
      }
    });

    setActiveAlerts(alerts);
    if (alerts.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleSearch = async () => {
    if (!coords) {
      Alert.alert('Localização', 'É necessário ativar a localização primeiro.');
      return;
    }
    setLoadingPlaces(true);
    try {
      const results = await placesService.searchNearbyPlaces(coords.lat, coords.lng, keyword.trim() || 'lotérica');
      setPlaces(results);
      if (results.length === 0) Alert.alert('Busca', 'Nenhum local próximo encontrado para esse termo.');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível buscar locais próximos.');
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleSavePlace = async (place: PlaceResult) => {
    if (!user?.uid) return;
    try {
      await geoReminderService.saveMonitoredLocation(user.uid, place.placeId, place.name, place.lat, place.lng, category);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadLocations();
      Alert.alert('Sucesso', `${place.name} foi salvo para monitorar contas de ${category}.`);
      setSearchModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível salvar o local.');
    }
  };

  const handleToggleLocation = async (item: MonitoredLocation, active: boolean) => {
    if (!user?.uid) return;
    await geoReminderService.setLocationActive(item.id, active, user.uid);
    const saved = await loadLocations();
    if (coords) checkInternalAlerts(coords.lat, coords.lng, saved);
  };

  const handleDeleteLocation = (item: MonitoredLocation) => {
    if (!user?.uid) return;
    Alert.alert('Remover local', `Remover ${item.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await geoReminderService.deleteLocation(item.id, user.uid);
          const saved = await loadLocations();
          if (coords) checkInternalAlerts(coords.lat, coords.lng, saved);
        },
      },
    ]);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.title} numberOfLines={1}>Lembretes por Local</Text>
          <View style={s.gpsBadge}>
            <View style={[s.gpsDot, { backgroundColor: locationState === 'granted' ? '#10B981' : '#EF4444' }]} />
            <Text style={s.gpsText} numberOfLines={1}>
              {locationState === 'granted' ? currentCity || 'GPS Ativo' : 'GPS Desativado'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={refreshEnvironment} disabled={isRefreshing}>
          {isRefreshing ? <ActivityIndicator color="#111827" size="small" /> : <Ionicons name="sync-outline" size={20} color="#111827" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* 1. Alerta Interno de Contas Próximas */}
        {activeAlerts.map((alert, idx) => (
          <View key={idx} style={s.alertBanner}>
            <View style={s.alertHeader}>
              <Ionicons name="notifications-circle" size={26} color="#DC2626" />
              <Text style={s.alertTitle}>Contas Próximas!</Text>
            </View>
            <Text style={s.alertText}>
              Você está a {alert.distance}m de <Text style={{fontWeight: '800'}}>{alert.placeName}</Text>.
              Há {alert.bills.length} conta(s) pendente(s) da categoria {alert.category} totalizando {fmt(alert.bills.reduce((acc, b) => acc + b.amount, 0))}.
            </Text>
          </View>
        ))}

        {/* 2. Locais Monitorados Salvos */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Meus Locais</Text>
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
                  <Text style={s.placeAddress} numberOfLines={1}>{item.billCategory} • Alerta: 200m</Text>
                </View>
                <Switch
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
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
            <Text style={{fontWeight: '700'}}>Privacidade:</Text> Sua localização é usada apenas no seu celular.
          </Text>
        </View>
      </ScrollView>

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setSearchModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal de Busca de Novos Locais */}
      <Modal visible={isSearchModalVisible} animationType="slide" transparent onRequestClose={() => setSearchModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Monitorar novo local</Text>
            
            <Text style={s.label}>O que você procura?</Text>
            <TextInput style={s.input} value={keyword} onChangeText={setKeyword} placeholder="Ex: lotérica, banco..." placeholderTextColor="#9CA3AF" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.keywordList}>
              {DEFAULT_KEYWORDS.map((item) => (
                <TouchableOpacity key={item} style={[s.chip, keyword === item && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => setKeyword(item)}>
                  <Text style={[s.chipText, keyword === item && { color: '#fff' }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Tipo de conta a ser paga:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.keywordList}>
              {CATEGORIES.map((item) => (
                <TouchableOpacity key={item} style={[s.chip, category === item && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => setCategory(item)}>
                  <Text style={[s.chipText, category === item && { color: '#fff' }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.accent }]} onPress={handleSearch} disabled={loadingPlaces}>
              {loadingPlaces ? <ActivityIndicator color="#fff" /> : <Ionicons name="search-outline" size={18} color="#fff" />}
              <Text style={s.primaryBtnText}>Buscar lugares próximos</Text>
            </TouchableOpacity>

            {places.length > 0 && (
              <ScrollView style={{ marginTop: 16, maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                {places.map((place) => (
                  <TouchableOpacity key={place.placeId} style={s.placeRow} onPress={() => handleSavePlace(place)}>
                    <View style={{ flex: 1 }}><Text style={s.placeName}>{place.name}</Text><Text style={s.placeAddress}>{place.distanceMeters}m • {place.address}</Text></View>
                    <Ionicons name="add-circle" size={24} color={theme.accent} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  gpsDot: { width: 6, height: 6, borderRadius: 3 },
  gpsText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 140 },
  alertBanner: { backgroundColor: '#FEF2F2', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 14 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  alertTitle: { fontSize: 16, fontWeight: '800', color: '#991B1B' },
  alertText: { fontSize: 14, color: '#991B1B', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  muted: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  keywordList: { gap: 8, paddingRight: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '700' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, marginTop: 24 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  placeName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  placeAddress: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { marginTop: 8, fontSize: 13, color: '#6B7280' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEF2F7' },
  infoText: { flex: 1, minWidth: 0, color: '#6B7280', fontSize: 12, lineHeight: 18, marginTop: 1 },
  fab: { position: 'absolute', right: 24, bottom: 90, width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16, textAlign: 'center' },
});
