import type { CreditCard } from '@/context/FinanceContext';

export type CardLimitLevel = 'ok' | 'warning' | 'important' | 'critical';

export type AppNotification = {
  id: string;
  userId: string;
  type: 'card_limit_warning' | 'card_limit_critical' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedCardId?: string;
};

export type CardLimitInfo = {
  limit: number;
  used: number;
  available: number;
  percentage: number;
  level: CardLimitLevel;
  label: string;
  color: string;
  softColor: string;
};

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getCardLimitInfo(card?: Partial<CreditCard> | null): CardLimitInfo {
  const limit = Math.max(asNumber((card as any)?.limitAmount ?? card?.limit), 0);
  const used = Math.max(asNumber(card?.used), 0);
  const available = Math.max(limit - used, 0);
  const percentage = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  if (percentage >= 95) {
    return {
      limit,
      used,
      available,
      percentage,
      level: 'critical',
      label: 'Crítico',
      color: '#DC2626',
      softColor: '#FEF2F2',
    };
  }

  if (percentage >= 85) {
    return {
      limit,
      used,
      available,
      percentage,
      level: 'important',
      label: 'Atenção',
      color: '#D97706',
      softColor: '#FFFBEB',
    };
  }

  if (percentage >= 70) {
    return {
      limit,
      used,
      available,
      percentage,
      level: 'warning',
      label: 'Em observação',
      color: '#F59E0B',
      softColor: '#FFFBEB',
    };
  }

  return {
    limit,
    used,
    available,
    percentage,
    level: 'ok',
    label: 'Saudável',
    color: '#059669',
    softColor: '#F0FDF4',
  };
}

export function canUseCardAmount(card: Partial<CreditCard> | null | undefined, amount: number) {
  const info = getCardLimitInfo(card);
  const value = Math.max(asNumber(amount), 0);

  return {
    ok: !!card && value > 0 && value <= info.available,
    available: info.available,
    afterUsePercentage: info.limit > 0 ? Math.min(Math.round(((info.used + value) / info.limit) * 100), 100) : 0,
  };
}

export function buildCardLimitNotifications(cards: CreditCard[], userId: string): AppNotification[] {
  const now = new Date().toISOString();
  const notifications: AppNotification[] = [];

  cards.forEach((card) => {
    const info = getCardLimitInfo(card);
    if (info.level === 'ok') return;

    const critical = info.level === 'critical';
    notifications.push({
      id: `card-limit-${card.id}-${info.level}`,
      userId,
      type: critical ? 'card_limit_critical' : 'card_limit_warning',
      title: critical ? 'Cartão quase no limite' : 'Atenção ao limite do cartão',
      message: critical
        ? `Cuidado: o cartão ${card.name} já usou ${info.percentage}% do limite.`
        : `Atenção: seu cartão ${card.name} já usou ${info.percentage}% do limite.`,
      read: false,
      createdAt: now,
      relatedCardId: card.id,
    });
  });

  return notifications;
}
