import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './apiConfig';

export interface RegionalAverage {
  avgExpense: number;
  userCount: number;
}

interface RegionalContribution {
  city: string;
  category: string;
  totalExpense: number;
  periodMonth?: string;
}

const REQUEST_TIMEOUT_MS = 7000;
const ANONYMOUS_CONTRIBUTOR_KEY = 'cofre_regional_anonymous_contributor_id';

function asNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentPeriodMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeKeyPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getAnonymousContributorId() {
  const existing = await AsyncStorage.getItem(ANONYMOUS_CONTRIBUTOR_KEY);
  if (existing) return existing;

  const next = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(ANONYMOUS_CONTRIBUTOR_KEY, next);
  return next;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const request = fetch(url, options);
  return Promise.race([
    request,
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('A conexao com o backend demorou demais.')), REQUEST_TIMEOUT_MS);
    }),
  ]);
}

// MOCK TEMPORÁRIO: Retorna dados coerentes para testar a tela enquanto o backend não está 100%
// Desativado por padrão (USE_MOCKS = false) conforme regras de negócio.
function getMockFallback(category: string): RegionalAverage {
  const bases: Record<string, number> = {
    'Alimentação': 850,
    'Transporte': 350,
    'Lazer': 400,
    'Saúde': 250,
    'Moradia': 1500,
    'Educação': 600,
    'Outros': 200,
  };
  
  const base = bases[category] || 500;
  // Gera uma variação aleatória de até 15% para parecer real
  const variation = base * (0.85 + Math.random() * 0.3);
  const users = Math.floor(Math.random() * 500) + 120;

  return { avgExpense: Number(variation.toFixed(2)), userCount: users };
}

export const regionalComparisonService = {
  async submitAnonymousContribution(userId: string, { city, category, totalExpense, periodMonth = currentPeriodMonth() }: RegionalContribution): Promise<void> {
    if (!userId || !city || city === 'Desconhecida' || !category || totalExpense <= 0) return;

    const contributorId = await getAnonymousContributorId();
    const submissionKey = [
      'cofre_regional_submission',
      contributorId,
      periodMonth,
      normalizeKeyPart(city),
      normalizeKeyPart(category),
    ].join(':');
    const contributionKey = submissionKey.replace('cofre_regional_submission:', '');
    const roundedTotal = totalExpense.toFixed(2);

    try {
      const lastSubmittedTotal = await AsyncStorage.getItem(submissionKey);
      if (lastSubmittedTotal === roundedTotal) return;

      const response = await fetchWithTimeout(`${API_URL}/regional-contribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city,
          category,
          totalExpense,
          periodMonth,
          contributionKey,
        }),
      });

      if (response.ok) {
        await AsyncStorage.setItem(submissionKey, roundedTotal);
      }
    } catch {
      // A comparacao continua funcionando localmente mesmo sem backend.
    }
  },

  async fetchAverage(city: string, category: string): Promise<RegionalAverage> {
    if (!city || !category || city === 'Desconhecida') {
      return { avgExpense: 0, userCount: 0 };
    }

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/regional-averages?city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}&periodMonth=${currentPeriodMonth()}`
      );

      if (!response.ok) {
        throw new Error(`Falha ao buscar media regional: ${response.status}`);
      }

      const data = await response.json();
      return {
        avgExpense: asNumber(data.avgExpense ?? data.avg_expense),
        userCount: asNumber(data.userCount ?? data.user_count),
      };
    } catch {
      // Caso o backend falhe ou não exista, retornamos zeros (0 usuários)
      // Isso ativará a tela de "Dados insuficientes" no app, garantindo que não exibiremos médias irreais.
      const USE_MOCKS = false; // Desativado conforme regra estrita: não usar dados falsos como se fossem reais.
      if (USE_MOCKS) return getMockFallback(category);
      return { avgExpense: 0, userCount: 0 };
    }
  },
};
