import { Alert, Share } from 'react-native';

export const exportService = {
  // RF28 - Exportar para IR via Share nativo (funciona no Expo Go)
  async exportToIR(transactions: any[], year: number): Promise<void> {
    const expenses = transactions.filter(t => t.type === 'expense');
    const income   = transactions.filter(t => t.type === 'income');
    const totalInc = income.reduce((s, t) => s + t.amount, 0);
    const deductible = expenses.filter(t => ['Saúde', 'Educação'].includes(t.category));
    const totalDed = deductible.reduce((s, t) => s + t.amount, 0);

    const lines = [
      `COFRE DIGITAL — RELATÓRIO PARA IR ${year}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      ``,
      `=== RENDIMENTOS TRIBUTÁVEIS ===`,
      ...income.map(t =>
        `${new Date(t.date).toLocaleDateString('pt-BR')} | ${t.description} | R$ ${t.amount.toFixed(2)}`
      ),
      `TOTAL RENDIMENTOS: R$ ${totalInc.toFixed(2)}`,
      ``,
      `=== DESPESAS DEDUTÍVEIS (Saúde e Educação) ===`,
      ...deductible.map(t =>
        `${new Date(t.date).toLocaleDateString('pt-BR')} | ${t.description} | ${t.category} | R$ ${t.amount.toFixed(2)}`
      ),
      `TOTAL DEDUTÍVEL: R$ ${totalDed.toFixed(2)}`,
      ``,
      `=== RESUMO ===`,
      `Rendimentos totais: R$ ${totalInc.toFixed(2)}`,
      `Despesas dedutíveis: R$ ${totalDed.toFixed(2)}`,
      ``,
      `Gerado pelo Cofre Digital`,
    ];

    const text = lines.join('\n');

    try {
      await Share.share({ message: text, title: `IR ${year} - Cofre Digital` });
    } catch {
      Alert.alert('Exportar IR', text.slice(0, 500) + '\n\n[Compartilhe este texto com seu contador]');
    }
  },
};
