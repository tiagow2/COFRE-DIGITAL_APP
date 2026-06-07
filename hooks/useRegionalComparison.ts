import { RegionalAverage, regionalComparisonService } from '@/services/regionalComparisonService';
import { useEffect, useState } from 'react';

export type ComparisonStatus = 'above_average' | 'below_average' | 'within_average';

export interface RegionalComparisonResult {
  category: string;
  userAmount: number;
  regionalAverage: number;
  differenceAmount: number;
  differencePercentage: number;
  status: ComparisonStatus;
  sampleSize: number;
}

export function useRegionalComparison(userId: string | undefined, city: string, category: string, userAmount: number) {
  const [result, setResult] = useState<RegionalComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!city || !category) return;

    const fetchComparison = async () => {
      setLoading(true);
      setError('');
      try {
        // Envia os dados anônimos (se maior que zero) e busca a média
        if (userAmount > 0 && userId) {
          await regionalComparisonService.submitAnonymousContribution(userId, { city, category, totalExpense: userAmount });
        }
        
        const data: RegionalAverage = await regionalComparisonService.fetchAverage(city, category);
        
        const differenceAmount = userAmount - data.avgExpense;
        const differencePercentage = data.avgExpense > 0 ? (differenceAmount / data.avgExpense) * 100 : 0;
        
        // Margem de tolerância de 10% para "dentro da média"
        let status: ComparisonStatus = 'within_average';
        if (differencePercentage > 10) status = 'above_average';
        else if (differencePercentage < -10) status = 'below_average';

        setResult({
          category, userAmount, regionalAverage: data.avgExpense, differenceAmount, differencePercentage, status, sampleSize: data.userCount
        });
      } catch (err) {
        setError('Não foi possível carregar as médias regionais.');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [city, category, userAmount]);

  return { result, loading, error };
}
