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

export const DEFAULT_REMINDERS: Omit<GeoReminder, 'id'>[] = [
  { label: 'Lotérica', lat: 0, lng: 0, radiusMeters: 200, message: 'Você está perto de uma lotérica. Tem contas a pagar?', active: true },
  { label: 'Banco', lat: 0, lng: 0, radiusMeters: 150, message: 'Você está perto de um banco. Verifique suas pendências financeiras.', active: true },
  { label: 'Supermercado', lat: 0, lng: 0, radiusMeters: 100, message: 'Você está no supermercado. Controle seus gastos.', active: true },
];

const LOCATION_TIMEOUT_MS = 12000;
const GEOCODE_TIMEOUT_MS = 9000;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export const geoLocationService = {
  async requestPermission(): Promise<boolean> {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;

    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.granted;
  },

  async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    const granted = await this.requestPermission();
    if (!granted) return null;

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error('Ative a localização/GPS do aparelho para usar este recurso.');
    }

    try {
      const current = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        }),
        LOCATION_TIMEOUT_MS,
        'Não consegui obter sua localização agora. Tente novamente em alguns segundos.'
      );

      return { lat: current.coords.latitude, lng: current.coords.longitude };
    } catch (error) {
      const lastKnown = await withTimeout(
        Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 3000 }),
        4000,
        'Sem última localização conhecida.'
      ).catch(() => null);

      if (lastKnown) {
        return { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
      }

      throw error;
    }
  },

  async getCurrentCity(): Promise<string> {
    const loc = await this.getCurrentLocation();
    if (!loc) return 'Desconhecida';

    const places = await withTimeout(
      Location.reverseGeocodeAsync({ latitude: loc.lat, longitude: loc.lng }),
      GEOCODE_TIMEOUT_MS,
      'Não consegui identificar sua cidade agora.'
    );

    const place = places[0];
    return place?.city ?? place?.subregion ?? place?.district ?? 'Desconhecida';
  },

  checkReminders(currentLat: number, currentLng: number, reminders: GeoReminder[]): GeoReminder[] {
    return reminders.filter((reminder) => {
      if (!reminder.active || reminder.lat === 0) return false;
      const distance = distanceMeters(currentLat, currentLng, reminder.lat, reminder.lng);
      return distance <= reminder.radiusMeters;
    });
  },

  async triggerNearbyReminders(reminders: GeoReminder[]): Promise<GeoReminder[]> {
    const loc = await this.getCurrentLocation();
    if (!loc) return [];
    return this.checkReminders(loc.lat, loc.lng, reminders);
  },
};
