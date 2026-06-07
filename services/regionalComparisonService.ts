import { API_URL } from './apiConfig';

export interface RegionalAverage {
  avgExpense: number;
  userCount: number;
}

function asNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const regionalComparisonService = {
  async registerCity(userId: string, city: string): Promise<void> {
    if (!userId || !city || city === 'Desconhecida') return;

    await fetch(`${API_URL}/user-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({ city }),
    });
  },

  async fetchAverage(userId: string, city: string, category: string): Promise<RegionalAverage> {
    if (!userId || !city || !category || city === 'Desconhecida') {
      return { avgExpense: 0, userCount: 0 };
    }

    const response = await fetch(
      `${API_URL}/regional-averages?city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`,
      {
        headers: {
          'X-User-ID': userId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Falha ao buscar media regional: ${response.status}`);
    }

    const data = await response.json();
    return {
      avgExpense: asNumber(data.avgExpense ?? data.avg_expense),
      userCount: asNumber(data.userCount ?? data.user_count),
    };
  },
};
