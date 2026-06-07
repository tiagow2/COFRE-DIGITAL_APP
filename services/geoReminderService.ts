import { getDatabase, initializeDatabase } from './database';
import { geoLocationService } from './geoLocationService';

const RADIUS_METERS = 200;

export interface MonitoredLocation {
  id: number;
  userId: string;
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

function asText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function mapLocation(row: any): MonitoredLocation {
  return {
    id: Number(row.id),
    userId: String(row.user_id ?? 'unknown'),
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
  async ensureUserColumn() {
    const db = getDatabase();
    try {
      await db.runAsync(`ALTER TABLE monitored_locations ADD COLUMN user_id TEXT DEFAULT 'unknown'`);
    } catch (e) {
      // Coluna provavelmente já existe, ignoramos
    }
  },

  async saveMonitoredLocation(userId: string, placeId: string, name: string, lat: number, lng: number, billCategory: string) {
    await initializeDatabase();
    await this.ensureUserColumn();
    const db = getDatabase();

    // Prefixamos o placeId com o userId para evitar conflitos de UNIQUE constraint no SQLite entre usuários diferentes no mesmo app
    const uniquePlaceId = placeId.startsWith(`${userId}::`) ? placeId : `${userId}::${placeId}`;

    await db.runAsync(
      `INSERT OR REPLACE INTO monitored_locations
       (user_id, place_id, name, lat, lng, bill_category, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT active FROM monitored_locations WHERE place_id = ? AND user_id = ?), 1), COALESCE((SELECT created_at FROM monitored_locations WHERE place_id = ? AND user_id = ?), datetime('now')))`,
      [userId, uniquePlaceId, name, lat, lng, billCategory, uniquePlaceId, userId, uniquePlaceId, userId]
    );
  },

  async saveCurrentLocation(userId: string, name: string, billCategory: string) {
    const current = await geoLocationService.getCurrentLocation();
    if (!current) throw new Error('Permita acesso a localizacao para salvar seu local atual.');

    await this.saveMonitoredLocation(
      userId,
      `manual:${current.lat.toFixed(6)},${current.lng.toFixed(6)}`,
      asText(name, 'Meu local atual'),
      current.lat,
      current.lng,
      billCategory
    );
  },

  async listMonitoredLocations(userId: string): Promise<MonitoredLocation[]> {
    await initializeDatabase();
    await this.ensureUserColumn();
    const db = getDatabase();
    const rows = await db.getAllAsync(
      `SELECT id, user_id, place_id, name, lat, lng, bill_category, active, last_notified_at
       FROM monitored_locations
       WHERE user_id = ?
       ORDER BY created_at DESC`
       , [userId]
    );
    return rows.map(row => {
      const loc = mapLocation(row);
      if (loc.placeId.startsWith(`${userId}::`)) {
        loc.placeId = loc.placeId.replace(`${userId}::`, '');
      }
      return loc;
    });
  },

  async setLocationActive(id: number, active: boolean, userId: string) {
    await initializeDatabase();
    await this.ensureUserColumn();
    const db = getDatabase();
    await db.runAsync(
      `UPDATE monitored_locations SET active = ? WHERE id = ? AND user_id = ?`,
      [active ? 1 : 0, id, userId]
    );
  },

  async deleteLocation(id: number, userId: string) {
    await initializeDatabase();
    await this.ensureUserColumn();
    const db = getDatabase();
    await db.runAsync(`DELETE FROM monitored_locations WHERE id = ? AND user_id = ?`, [id, userId]);
  },

  async checkNearbyLocations(userId: string): Promise<MonitoredLocation[]> {
    const current = await geoLocationService.getCurrentLocation();
    if (!current) throw new Error('Permita acesso a localizacao para verificar locais proximos.');

    const monitored = await this.listMonitoredLocations(userId);
    return monitored.filter((item) => {
      if (!item.active) return false;
      return distanceMeters(current.lat, current.lng, item.lat, item.lng) <= RADIUS_METERS;
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
