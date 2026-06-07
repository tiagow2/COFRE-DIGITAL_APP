import { distanceMeters } from './geoReminderService';

export type PlaceResult = {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  category?: string;
};

export const placesService = {
  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    keyword: string
  ): Promise<PlaceResult[]> {
    // Cria uma "caixa" (bounding box) de ~5km ao redor do usuário para travar a busca na região
    const minLon = longitude - 0.05;
    const maxLat = latitude + 0.05;
    const maxLon = longitude + 0.05;
    const minLat = latitude - 0.05;

    // OpenStreetMap Nominatim API travada no GPS (bounded=1)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1&limit=15`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'CofreDigitalApp/1.0', 'Accept-Language': 'pt-BR' }
    });

    if (!response.ok) {
      throw new Error(`Erro na busca de locais: ${response.status}`);
    }

    const data = await response.json();

    return data.map((item: any) => {
      const itemLat = Number(item.lat);
      const itemLng = Number(item.lon);
      return {
        placeId: String(item.place_id),
        name: item.name || item.display_name.split(',')[0],
        address: item.display_name,
        latitude: itemLat,
        longitude: itemLng,
        distanceMeters: Math.round(distanceMeters(latitude, longitude, itemLat, itemLng)),
      };
    })
    .filter((item: PlaceResult) => (item.distanceMeters ?? 0) <= 15000) // Filtro de segurança: máximo 15km
    .sort((a: PlaceResult, b: PlaceResult) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  },
};