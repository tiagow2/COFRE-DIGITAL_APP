// context/FinanceContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  category: string;
  icon: string;
  date: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: string;
  color: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
  icon: string;
  color: string;
}

export interface CreditCard {
  id: string;
  name: string;
  lastDigits: string;
  limit: number;
  used: number;
  dueDate: string;
  color: string;
}

export interface Loan {
  id: string;
  name: string;
  total: number;
  paid: number;
  installments: number;
  current: number;
  rate: number;
  monthly: number;
}

interface FinanceData {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  creditCards: CreditCard[];
  loans: Loan[];
}

interface FinanceContextType extends FinanceData {
  loadingData: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => void;
  deleteTransaction: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'current'>) => void;
  depositToGoal: (goalId: string, amount: number) => void;
  getBalance: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpenses: () => number;
  getBudgetStatus: (budget: Budget) => { spent: number; pct: number; remaining: number };
  suggestCategory: (description: string) => string;
}

const FinanceContext = createContext<FinanceContextType>({} as FinanceContextType);

const INITIAL: FinanceData = {
  transactions: [
    { id: '1', type: 'expense', description: 'Supermercado Extra',    amount: 143.20, category: 'Alimentação', icon: '🛒', date: new Date().toISOString() },
    { id: '2', type: 'income',  description: 'Salário',               amount: 6500.00, category: 'Receita',     icon: '💼', date: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: '3', type: 'expense', description: 'Posto Shell',           amount: 180.00, category: 'Transporte',  icon: '⛽', date: new Date(Date.now() - 86400000 * 6).toISOString() },
    { id: '4', type: 'expense', description: 'Netflix',               amount: 39.90,  category: 'Lazer',       icon: '🎬', date: new Date(Date.now() - 86400000 * 7).toISOString() },
    { id: '5', type: 'expense', description: 'Farmácia São Paulo',    amount: 68.40,  category: 'Saúde',       icon: '💊', date: new Date(Date.now() - 86400000 * 8).toISOString() },
  ],
  budgets: [
    { id: '1', category: 'Alimentação', limit: 1000, period: 'monthly', color: '#EF9F27' },
    { id: '2', category: 'Transporte',  limit: 500,  period: 'monthly', color: '#1D9E75' },
    { id: '3', category: 'Lazer',       limit: 300,  period: 'monthly', color: '#D85A30' },
    { id: '4', category: 'Saúde',       limit: 400,  period: 'monthly', color: '#378ADD' },
  ],
  goals: [
    { id: '1', name: 'Viagem para Europa 🌍',   target: 15000, current: 10050, monthly: 500,  icon: '✈️',  color: '#1D9E75' },
    { id: '2', name: 'Reserva de emergência 🏦', target: 30000, current: 9900,  monthly: 1000, icon: '🏦',  color: '#EF9F27' },
    { id: '3', name: 'Notebook novo 💻',         target: 5000,  current: 900,   monthly: 300,  icon: '💻',  color: '#D85A30' },
  ],
  creditCards: [
    { id: '1', name: 'Nubank', lastDigits: '4521', limit: 5000, used: 1240, dueDate: '15/05/2026', color: '#6C35DE' },
    { id: '2', name: 'Itaú',   lastDigits: '8834', limit: 4000, used: 3800, dueDate: '20/05/2026', color: '#003882' },
  ],
  loans: [
    { id: '1', name: 'Financiamento moto', total: 5400, paid: 3600, installments: 12, current: 8, rate: 1.2, monthly: 450 },
  ],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['mercado', 'supermercado', 'ifood', 'restaurante', 'padaria', 'pizza', 'lanche', 'refeicao'],
  'Transporte':  ['posto', 'gasolina', 'uber', 'onibus', 'metro', 'bilhete', 'combustivel', 'shell', 'petrobras'],
  'Lazer':       ['netflix', 'cinema', 'spotify', 'jogo', 'viagem', 'hotel', 'amazon prime'],
  'Saúde':       ['farmacia', 'remedio', 'medico', 'hospital', 'consulta', 'exame', 'drogaria'],
  'Moradia':     ['aluguel', 'condominio', 'luz', 'agua', 'internet', 'gas', 'energia'],
  'Educação':    ['curso', 'faculdade', 'livro', 'escola', 'apostila'],
};

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceData>(INITIAL);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const key = () => `@cofre_finance_${user?.uid}`;

  const loadData = async () => {
    try {
      const raw = await AsyncStorage.getItem(key());
      if (raw) setData(JSON.parse(raw));
    } catch {}
    finally { setLoadingData(false); }
  };

  const persist = async (d: FinanceData) => {
    try { await AsyncStorage.setItem(key(), JSON.stringify(d)); } catch {}
  };

  const update = (updater: (d: FinanceData) => FinanceData) => {
    setData((prev: FinanceData) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  };

  const addTransaction = (tx: Omit<Transaction, 'id' | 'date'>) => {
    update(d => ({
      ...d,
      transactions: [{ ...tx, id: Date.now().toString(), date: new Date().toISOString() }, ...d.transactions],
    }));
  };

  const deleteTransaction = (id: string) =>
    update(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));

  const addGoal = (goal: Omit<Goal, 'id' | 'current'>) =>
    update(d => ({ ...d, goals: [...d.goals, { ...goal, id: Date.now().toString(), current: 0 }] }));

  const depositToGoal = (goalId: string, amount: number) =>
    update(d => ({
      ...d,
      goals: d.goals.map(g => g.id === goalId ? { ...g, current: g.current + amount } : g),
    }));

  const now = new Date();

  const monthlyTxs = (type: TxType) => data.transactions.filter((t: { date: string | number | Date; type: string; }) => {
    const d = new Date(t.date);
    return t.type === type && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const getBalance = () =>
    data.transactions.reduce((acc: number, t: { type: string; amount: number; }) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);

  const getMonthlyIncome = () => monthlyTxs('income').reduce((a: any, t: { amount: any; }) => a + t.amount, 0);
  const getMonthlyExpenses = () => monthlyTxs('expense').reduce((a: any, t: { amount: any; }) => a + t.amount, 0);

  const getBudgetStatus = (b: Budget) => {
    const spent = data.transactions
      .filter((t: { date: string | number | Date; type: string; category: string; }) => {
        const d = new Date(t.date);
        return t.type === 'expense' && t.category === b.category &&
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((a: any, t: { amount: any; }) => a + t.amount, 0);
    const pct = Math.round((spent / b.limit) * 100);
    return { spent, pct, remaining: b.limit - spent };
  };

  const suggestCategory = (description: string): string => {
    const d = description.toLowerCase();
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      if (kws.some(k => d.includes(k))) return cat;
    }
    return 'Outros';
  };

  return (
    <FinanceContext.Provider value={{
      ...data, loadingData,
      addTransaction, deleteTransaction,
      addGoal, depositToGoal,
      getBalance, getMonthlyIncome, getMonthlyExpenses,
      getBudgetStatus, suggestCategory,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export const useFinance = () => useContext(FinanceContext);
