import { Alert, Share } from 'react-native';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const exportService = {
  async exportToIR(data: any, year: number): Promise<void> {
    const { user, transactions, loans, creditCards, goals } = data;
    
    const yearTxs = transactions.filter((t: any) => new Date(t.date || t.createdAt).getFullYear() === year);
    const expenses = yearTxs.filter((t: any) => t.type === 'expense');
    const incomes   = yearTxs.filter((t: any) => t.type === 'income');
    
    const totalIncome = incomes.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const finalBalance = totalIncome - totalExpenses;

    // Agrupar despesas por categoria
    const categoriesMap: Record<string, number> = {};
    expenses.forEach((t: any) => {
      const cat = t.category || 'Outros';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + Number(t.amount || 0);
    });
    const categoriesList = Object.entries(categoriesMap).sort((a, b) => b[1] - a[1]);

    // Transações de alto valor (> 5000)
    const highValueTxs = yearTxs.filter((t: any) => Number(t.amount || 0) >= 5000);

    const lines = [
      `COFRE DIGITAL — Relatório Simulado para Imposto de Renda`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      ``,
      `Usuário: ${user?.name?.toUpperCase() || 'USUÁRIO NÃO IDENTIFICADO'}`,
      `E-mail: ${user?.email || 'Não informado'}`,
      `Ano de referência: ${year}`,
      ``,
      `--------------------------------------------------`,
      `RESUMO ANUAL`,
      `--------------------------------------------------`,
      `Total de receitas: ${fmt(totalIncome)}`,
      `Total de despesas: ${fmt(totalExpenses)}`,
      `Saldo final do ano: ${fmt(finalBalance)}`,
      ``,
      `--------------------------------------------------`,
      `DESPESAS POR CATEGORIA`,
      `--------------------------------------------------`,
      ...(categoriesList.length > 0
          ? categoriesList.map(([cat, amount]) => `${cat}: ${fmt(amount)}`)
          : ['Nenhuma despesa registrada neste ano.']),
      ``,
      `--------------------------------------------------`,
      `TRANSAÇÕES DE ALTO VALOR (Acima de R$ 5.000,00)`,
      `--------------------------------------------------`,
      ...(highValueTxs.length > 0
          ? highValueTxs.map((t: any) => `${new Date(t.date || t.createdAt).toLocaleDateString('pt-BR')} - ${t.description} - ${fmt(Number(t.amount))}`)
          : ['Nenhuma transação de alto valor registrada.']),
      ``,
      `--------------------------------------------------`,
      `DÍVIDAS E EMPRÉSTIMOS`,
      `--------------------------------------------------`,
      ...(loans.length > 0
          ? loans.map((l: any) => `${l.name} | Total: ${fmt(Number(l.totalAmount))} | Parcelas pagas: ${l.paidInstallments}`)
          : ['Nenhuma dívida registrada.']),
      ``,
      `--------------------------------------------------`,
      `METAS DE ECONOMIA (Reservas)`,
      `--------------------------------------------------`,
      ...(goals.length > 0
          ? goals.map((g: any) => `${g.name} | Guardado: ${fmt(Number(g.current))} | Alvo: ${fmt(Number(g.target))}`)
          : ['Nenhuma meta registrada.']),
      ``,
      `--------------------------------------------------`,
      `CARTÕES DE CRÉDITO ATIVOS`,
      `--------------------------------------------------`,
      ...(creditCards.length > 0
          ? creditCards.map((c: any) => `${c.name} | Limite: ${fmt(Number(c.limit || c.limitAmount))} | Fatura atual: ${fmt(Number(c.used))}`)
          : ['Nenhum cartão registrado.']),
      ``,
      `==================================================`,
      `AVISO LEGAL:`,
      `Este relatório é uma simulação acadêmica gerada pelo app COFRE DIGITAL.`,
      `Ele não substitui documentos oficiais da Receita Federal e deve ser usado apenas como apoio para organização financeira.`,
      `==================================================`
    ];

    const text = lines.join('\n');

    try {
      await Share.share({ message: text, title: `cofre_digital_relatorio_ir_${year}.txt` });
    } catch {
      Alert.alert('Exportar IR', text.slice(0, 500) + '\n\n[Compartilhe este texto com seu contador]');
    }
  },
};
