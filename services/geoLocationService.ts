import * as Location from 'expo-location';

export interface GeoReminder {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  message: string;
  active: boolean;
}

// Locais padrão conhecidos onde se paga contas
export const DEFAULT_REMINDERS: Omit<GeoReminder, 'id'>[] = [
  { label: 'Lotérica', lat: 0, lng: 0, radiusMeters: 200, message: 'Você está perto de uma lotérica! Tem contas a pagar?', active: true },
  { label: 'Banco', lat: 0, lng: 0, radiusMeters: 150, message: 'Você está perto de um banco. Verifique suas pendências financeiras.', active: true },
  { label: 'Supermercado', lat: 0, lng: 0, radiusMeters: 100, message: 'Você está no supermercado. Controle seus gastos!', active: true },
];

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const geoLocationService = {
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    const granted = await this.requestPermission();
    if (!granted) return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  },

  async getCurrentCity(): Promise<string> {
    const loc = await this.getCurrentLocation();
    if (!loc) return 'Desconhecida';
    const [place] = await Location.reverseGeocodeAsync({ latitude: loc.lat, longitude: loc.lng });
    return place?.city ?? place?.subregion ?? 'Desconhecida';
  },

  checkReminders(currentLat: number, currentLng: number, reminders: GeoReminder[]): GeoReminder[] {
    return reminders.filter(r => {
      if (!r.active || r.lat === 0) return false;
      const dist = distanceMeters(currentLat, currentLng, r.lat, r.lng);
      return dist <= r.radiusMeters;
    });
  },

  async triggerNearbyReminders(reminders: GeoReminder[]): Promise<GeoReminder[]> {
    const loc = await this.getCurrentLocation();
    if (!loc) return [];
    return this.checkReminders(loc.lat, loc.lng, reminders);
  },
};
