import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './apiConfig';

export interface RegionalAverage {
  avgExpense: number;
  userCount: number;
  source?: 'backend' | 'fixed_sjc';
}

interface RegionalContribution {
  city: string;
  category: string;
  totalExpense: number;
  periodMonth?: string;
}

const REQUEST_TIMEOUT_MS = 7000;
const ANONYMOUS_CONTRIBUTOR_KEY = 'cofre_regional_anonymous_contributor_id';
const SJC_FIXED_USER_COUNT = 0;
const SJC_FIXED_REGIONAL_AVERAGES: Record<string, number> = {
  alimentacao: 790,
  transporte: 380,
  lazer: 260,
  saude: 360,
  moradia: 1978,
  educacao: 690,
  outros: 310,
};

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

function isSaoJoseDosCampos(city: string) {
  const normalized = normalizeKeyPart(city);
  return normalized === 'sjc' || normalized.includes('sao-jose-dos-campos');
}

function getFixedSjcAverage(city: string, category: string): RegionalAverage | null {
  if (!isSaoJoseDosCampos(city)) return null;

  const avgExpense = SJC_FIXED_REGIONAL_AVERAGES[normalizeKeyPart(category)];
  if (!avgExpense) return null;

  return { avgExpense, userCount: SJC_FIXED_USER_COUNT, source: 'fixed_sjc' };
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

    const fixedSjcAverage = getFixedSjcAverage(city, category);
    if (fixedSjcAverage) return fixedSjcAverage;

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
        source: 'backend',
      };
    } catch {
      // Caso o backend falhe ou não exista, retornamos zeros (0 usuários)
      // Isso ativará a tela de "Dados insuficientes" no app, garantindo que não exibiremos médias irreais.
      return { avgExpense: 0, userCount: 0 };
    }
  },
};
