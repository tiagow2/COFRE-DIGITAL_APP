import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SplitExpense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  createdAt: string;
  recurringBillId?: string;
}

export interface RecurringBill {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  dueDay: number;
  category: string;
  active: boolean;
  lastGeneratedMonth?: string;
  createdAt: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  members: string[];
  expenses: SplitExpense[];
  recurringBills: RecurringBill[];
  createdAt: string;
}

const keyFor = (userId: string) => `cofre_split_groups_${userId}`;

export const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const splitExpenseService = {
  async load(userId: string): Promise<SplitGroup[]> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async save(userId: string, groups: SplitGroup[]) {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(groups));
  },
};
