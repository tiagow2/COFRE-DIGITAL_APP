import * as Location from 'expo-location';
import { getDatabase, initializeDatabase } from './database';

const RADIUS_METERS = 200;

export interface NearbyPlace {
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  address: string;
}

export interface MonitoredLocation {
  id: number;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  billCategory: string;
  active: boolean;
  lastNotifiedAt?: string;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
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

function mapLocation(row: any): MonitoredLocation {
  return {
    id: Number(row.id),
    placeId: String(row.place_id ?? ''),
    name: String(row.name ?? ''),
    lat: Number(row.lat) || 0,
    lng: Number(row.lng) || 0,
    billCategory: String(row.bill_category ?? 'Contas'),
    active: Number(row.active ?? 1) === 1,
    lastNotifiedAt: row.last_notified_at ? String(row.last_notified_at) : undefined,
  };
}

export const geoReminderService = {
  async searchNearbyPlaces(lat: number, lng: number, apiKey: string, keyword = 'lotérica'): Promise<NearbyPlace[]> {
    if (!apiKey) {
      throw new Error('Configure EXPO_PUBLIC_GOOGLE_PLACES_API_KEY no arquivo .env.local.');
    }

    const url =
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
      `?location=${lat},${lng}` +
      '&radius=500' +
      `&keyword=${encodeURIComponent(keyword)}` +
      '&language=pt-BR' +
      `&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Places respondeu ${response.status}.`);

    const data = await response.json();
    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
      throw new Error(data.error_message || `Google Places: ${data.status}`);
    }

    return (data.results ?? []).map((place: any) => ({
      name: String(place.name ?? 'Local'),
      placeId: String(place.place_id ?? ''),
      lat: Number(place.geometry?.location?.lat) || 0,
      lng: Number(place.geometry?.location?.lng) || 0,
      address: String(place.vicinity ?? ''),
    })).filter((place: NearbyPlace) => place.placeId && place.lat && place.lng);
  },

  async saveMonitoredLocation(placeId: string, name: string, lat: number, lng: number, billCategory: string) {
    await initializeDatabase();
    const db = getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO monitored_locations
       (place_id, name, lat, lng, bill_category, active, created_at)
       VALUES (?, ?, ?, ?, ?, COALESCE((SELECT active FROM monitored_locations WHERE place_id = ?), 1), COALESCE((SELECT created_at FROM monitored_locations WHERE place_id = ?), datetime('now')))`,
      [placeId, name, lat, lng, billCategory, placeId, placeId]
    );
  },

  async listMonitoredLocations(): Promise<MonitoredLocation[]> {
    await initializeDatabase();
    const db = getDatabase();
    const rows = await db.getAllAsync(
      `SELECT id, place_id, name, lat, lng, bill_category, active, last_notified_at
       FROM monitored_locations
       ORDER BY created_at DESC`
    );
    return rows.map(mapLocation);
  },

  async setLocationActive(id: number, active: boolean) {
    await initializeDatabase();
    const db = getDatabase();
    await db.runAsync(
      `UPDATE monitored_locations SET active = ? WHERE id = ?`,
      [active ? 1 : 0, id]
    );
  },

  async deleteLocation(id: number) {
    await initializeDatabase();
    const db = getDatabase();
    await db.runAsync(`DELETE FROM monitored_locations WHERE id = ?`, [id]);
  },

  async checkNearbyLocations(): Promise<MonitoredLocation[]> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) throw new Error('Permita acesso a localizacao para verificar locais proximos.');

    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const monitored = await this.listMonitoredLocations();

    return monitored.filter((item) => {
      if (!item.active) return false;
      const distance = distanceMeters(
        current.coords.latitude,
        current.coords.longitude,
        item.lat,
        item.lng
      );
      return distance <= RADIUS_METERS;
    });
  },

  async startGeoMonitoring() {
    throw new Error('Monitoramento automatico foi desativado para funcionar no Expo Go.');
  },

  async stopGeoMonitoring() {},

  async isMonitoring() {
    return false;
  },
};
