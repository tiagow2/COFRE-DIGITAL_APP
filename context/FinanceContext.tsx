import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { initializeDatabase } from '@/services/database';
import { API_ORIGIN } from '@/services/apiConfig';
import { debugLogger } from '@/services/debugLogger';
import { FinanceRepository } from '@/services/repository';
import { getSyncService, initializeSyncService } from '@/services/sync';
import { canUseCardAmount, getCardLimitInfo, type CardLimitInfo } from '@/utils/cardLimits';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId?: string;
  user_id?: string;
  type: TxType;
  description: string;
  amount: number;
  category: string;
  icon: string;
  date: string;
  paymentMethod?: 'balance' | 'credit_card';
  creditCardId?: string;
  creditCardName?: string;
  signatureRequired?: boolean;
  signatureApproved?: boolean;
  signatureScore?: number;
  photo?: string;
  signature?: string;
}

export interface Budget {
  id: string;
  userId?: string;
  user_id?: string;
  category: string;
  limit: number;
  period: string;
  color: string;
}

export interface Goal {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
  icon: string;
  color: string;
}

export interface CreditCard {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  lastDigits: string;
  limit: number;
  used: number;
  dueDate: string;
  color: string;
}

export interface Loan {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  total: number;
  paid: number;
  installments: number;
  current: number;
  rate: number;
  monthly: number;
}

export interface Challenge {
  id: string;
  userId?: string;
  user_id?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  status: 'active' | 'completed';
  medalIcon: string;
}

interface FinanceData {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  creditCards: CreditCard[];
  loans: Loan[];
  challenges: Challenge[];
}

interface FinanceContextType extends FinanceData {
  loadingData: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'current'>) => Promise<void>;
  depositToGoal: (goalId: string, amount: number) => Promise<void>;
  addCreditCard: (card: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCreditCardUsed: (cardId: string, amount: number) => Promise<void>;
  addLoan: (loan: Omit<Loan, 'id'>) => Promise<void>;
  addChallenge: (challenge: Omit<Challenge, 'id' | 'currentAmount' | 'status'>) => Promise<void>;
  updateChallengeProgress: (challengeId: string, amount: number) => Promise<void>;
  getBalance: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpenses: () => number;
  getBudgetStatus: (budget: Budget) => { spent: number; pct: number; remaining: number };
  getCardUsedAmount: (cardId: string) => number;
  getCardAvailableLimit: (cardId: string) => number;
  getCardUsagePercentage: (cardId: string) => number;
  getCardLimitStatus: (cardId: string) => CardLimitInfo;
  canUseCardForTransaction: (cardId: string, amount: number) => { ok: boolean; available: number; afterUsePercentage: number };
  suggestCategory: (description: string) => string;
  isOnline: boolean;
  syncStatus: { pendingCount: number };
}

const FinanceContext = createContext<FinanceContextType>({} as FinanceContextType);

const INITIAL: FinanceData = {
  transactions: [],
  budgets: [],
  goals: [],
  creditCards: [],
  loans: [],
  challenges: [],
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
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<FinanceData>(INITIAL);
  const [loadingData, setLoadingData] = useState(true);
  const [repository, setRepository] = useState<FinanceRepository | null>(null);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0 });

  useEffect(() => {
    if (!user) {
      setRepository(null);
      setData(INITIAL);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const init = async () => {
      try {
        debugLogger.log('Inicializando FinanceContext com SQLite', { userId: user.uid });
        await initializeDatabase();
        const repo = new FinanceRepository(user.uid);
        setRepository(repo);
        const [txs, budgets, goals, cards, loans, challenges] = await Promise.all([
          repo.getTransactions(),
          repo.getBudgets(),
          repo.getGoals(),
          repo.getCreditCards(),
          repo.getLoans(),
          repo.getChallenges(),
        ]);
        setData({
          transactions: Array.isArray(txs) ? txs : INITIAL.transactions,
          budgets: Array.isArray(budgets) ? budgets : INITIAL.budgets,
          goals: Array.isArray(goals) ? goals : INITIAL.goals,
          creditCards: Array.isArray(cards) ? cards : INITIAL.creditCards,
          loans: Array.isArray(loans) ? loans : INITIAL.loans,
          challenges: Array.isArray(challenges) ? challenges : INITIAL.challenges,
        });
        initializeSyncService(
          {
            apiUrl: API_ORIGIN,
            userId: user.uid,
            syncImages: false,
          },
          repo
        );
        const syncService = getSyncService();
        syncService.setOnlineStatus(isOnline);
        await syncService.startAutoSync();
        const status = await syncService.getSyncStatus();
        setSyncStatus(status);
        debugLogger.log('FinanceContext inicializado com sucesso', { userId: user.uid });
      } catch (error) {
        debugLogger.log('Erro ao inicializar FinanceContext', { error: (error as Error).message });
      } finally {
        setLoadingData(false);
      }
    };

    init();
  }, [user]);

  useEffect(() => {
    if (repository) {
      try {
        const syncService = getSyncService();
        syncService.setOnlineStatus(isOnline);
        debugLogger.log('Status online atualizado', { isOnline });
      } catch (error) {
        debugLogger.log('Erro ao atualizar status online', { error: (error as Error).message });
      }
    }
  }, [isOnline, repository]);

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'date'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const normalizedTx: Omit<Transaction, 'id' | 'date'> = {
      ...tx,
      paymentMethod: tx.type === 'expense' ? tx.paymentMethod ?? 'balance' : 'balance',
    };

    const newTx = await repository.addTransaction(normalizedTx);

    // Se for despesa com cartão → atualizar o "used" do cartão
    let updatedCards = data.creditCards;
    if (normalizedTx.type === 'expense' && normalizedTx.paymentMethod === 'credit_card' && normalizedTx.creditCardId) {
      const card = data.creditCards.find((c) => c.id === normalizedTx.creditCardId);
      if (card) {
        const newUsed = card.used + normalizedTx.amount;
        await repository.updateCreditCardUsed(normalizedTx.creditCardId, newUsed);
        updatedCards = data.creditCards.map((c) =>
          c.id === normalizedTx.creditCardId ? { ...c, used: newUsed } : c
        );
      }
    }

    setData((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      creditCards: updatedCards,
    }));

    try {
      const syncService = getSyncService();
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch {}
  };

  const deleteTransaction = async (id: string) => {
    if (!repository) throw new Error('Repository not initialized');

    const removedTx = data.transactions.find((t) => t.id === id);
    await repository.deleteTransaction(id);

    let updatedCards = data.creditCards;
    if (removedTx?.type === 'expense' && removedTx.paymentMethod === 'credit_card' && removedTx.creditCardId) {
      const card = data.creditCards.find((c) => c.id === removedTx.creditCardId);
      if (card) {
        const newUsed = Math.max(card.used - removedTx.amount, 0);
        await repository.updateCreditCardUsed(card.id, newUsed);
        updatedCards = data.creditCards.map((c) =>
          c.id === card.id ? { ...c, used: newUsed } : c
        );
      }
    }

    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
      creditCards: updatedCards,
    }));
  };

  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const newBudget = await repository.addBudget(budget);
    setData((prev) => ({
      ...prev,
      budgets: [...prev.budgets, newBudget],
    }));
  };

  const addGoal = async (goal: Omit<Goal, 'id' | 'current'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const newGoal = await repository.addGoal(goal);
    setData((prev) => ({
      ...prev,
      goals: [...prev.goals, newGoal],
    }));
  };

  const depositToGoal = async (goalId: string, amount: number) => {
    if (!repository) throw new Error('Repository not initialized');

    await repository.depositToGoal(goalId, amount);

    const goal = data.goals.find(g => g.id === goalId);
    const goalName = goal?.name || 'Meta';
    const newTx = await repository.addTransaction({
      type: 'expense',
      description: `Depósito: ${goalName}`,
      amount,
      category: 'Metas',
      icon: goal?.icon || '🎯',
    });

    setData((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      goals: prev.goals.map((g) =>
        g.id === goalId ? { ...g, current: g.current + amount } : g
      ),
    }));
  };

  const addCreditCard = async (card: Omit<CreditCard, 'id'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const newCard = await repository.addCreditCard(card);
    setData((prev) => ({
      ...prev,
      creditCards: [...prev.creditCards, newCard],
    }));
  };

  const updateCreditCardUsed = async (cardId: string, amount: number) => {
    if (!repository) throw new Error('Repository not initialized');
    const card = data.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    const newUsed = card.used + amount;
    await repository.updateCreditCardUsed(cardId, newUsed);
    setData((prev) => ({
      ...prev,
      creditCards: prev.creditCards.map((c) =>
        c.id === cardId ? { ...c, used: newUsed } : c
      ),
    }));
  };

  const addLoan = async (loan: Omit<Loan, 'id'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const newLoan = await repository.addLoan(loan);
    setData((prev) => ({
      ...prev,
      loans: [...prev.loans, newLoan],
    }));
  };

  const addChallenge = async (challenge: Omit<Challenge, 'id' | 'currentAmount' | 'status'>) => {
    if (!repository) throw new Error('Repository not initialized');

    const newChallenge = await repository.addChallenge(challenge);
    setData((prev) => ({
      ...prev,
      challenges: [...prev.challenges, newChallenge],
    }));
  };

  const updateChallengeProgress = async (challengeId: string, amount: number) => {
    if (!repository) throw new Error('Repository not initialized');

    const challenge = data.challenges.find((c) => c.id === challengeId);
    if (!challenge) return;

    const newCurrent = Math.min(challenge.currentAmount + amount, challenge.targetAmount);
    const newStatus = newCurrent >= challenge.targetAmount ? 'completed' : 'active';

    await repository.updateChallengeProgress(challengeId, newCurrent, newStatus);
    
    setData((prev) => ({
      ...prev,
      challenges: prev.challenges.map((c) =>
        c.id === challengeId ? { ...c, currentAmount: newCurrent, status: newStatus } : c
      ),
    }));
  };

  const now = new Date();

  const monthlyTxs = (type: TxType) =>
    data.transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        t.type === type &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });

  const getBalance = () =>
    data.transactions.reduce(
      (acc, t) => {
        if (t.type === 'income') return acc + t.amount;
        return t.paymentMethod === 'credit_card' ? acc : acc - t.amount;
      },
      0
    );

  const getMonthlyIncome = () =>
    monthlyTxs('income').reduce((a, t) => a + t.amount, 0);

  const getMonthlyExpenses = () =>
    monthlyTxs('expense').reduce((a, t) => a + t.amount, 0);

  const getBudgetStatus = (b: Budget) => {
    const spent = data.transactions
      .filter((t) => {
        const d = new Date(t.date);
        return (
          t.type === 'expense' &&
          t.category === b.category &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((a, t) => a + t.amount, 0);
    const pct = Math.round((spent / b.limit) * 100);
    return { spent, pct, remaining: b.limit - spent };
  };

  const getCardById = (cardId: string) =>
    data.creditCards.find((card) => card.id === cardId);

  const getCardLimitStatus = (cardId: string) =>
    getCardLimitInfo(getCardById(cardId));

  const getCardUsedAmount = (cardId: string) =>
    getCardLimitStatus(cardId).used;

  const getCardAvailableLimit = (cardId: string) =>
    getCardLimitStatus(cardId).available;

  const getCardUsagePercentage = (cardId: string) =>
    getCardLimitStatus(cardId).percentage;

  const canUseCardForTransaction = (cardId: string, amount: number) =>
    canUseCardAmount(getCardById(cardId), amount);

  const suggestCategory = (description: string): string => {
    const d = description.toLowerCase();
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      if (kws.some((k) => d.includes(k))) return cat;
    }
    return 'Outros';
  };

  return (
    <FinanceContext.Provider
      value={{
        ...data,
        creditCards: data.creditCards,
        loadingData,
        addTransaction,
        deleteTransaction,
        addBudget,
        addGoal,
        depositToGoal,
        addCreditCard,
        updateCreditCardUsed,
        addLoan,
        addChallenge,
        updateChallengeProgress,
        getBalance,
        getMonthlyIncome,
        getMonthlyExpenses,
        getBudgetStatus,
        getCardUsedAmount,
        getCardAvailableLimit,
        getCardUsagePercentage,
        getCardLimitStatus,
        canUseCardForTransaction,
        suggestCategory,
        isOnline,
        syncStatus,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export const useFinance = () => useContext(FinanceContext);
