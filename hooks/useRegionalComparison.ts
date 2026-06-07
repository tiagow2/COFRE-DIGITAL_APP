
import { debugLogger } from '@/services/debugLogger';
import { getSyncService } from '@/services/sync';
import { useEffect, useState } from 'react';

interface RegionalAverage {
  yourAverage: number;
  regionAverage: number;
  userCount: number;
  percentageDifference: number; // positivo = você gasta mais, negativo = você gasta menos
  status: 'above' | 'below' | 'equal'; // acima, abaixo ou igual à média
}

export function useRegionalComparison(city: string, category: string, yourAverage: number) {
  const [comparison, setComparison] = useState<RegionalAverage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        const syncService = getSyncService();
        await syncService.fetchRegionalAverages(city, category);

        
        setLoading(false);
      } catch (error) {
        debugLogger.log('Erro ao carregar comparação regional', {
          error: (error as Error).message,
        });
        setLoading(false);
      }
    };

    if (city && category && yourAverage > 0) {
      fetchComparison();
    }
  }, [city, category, yourAverage]);

  return { comparison, loading };
}
