import { conflict, invalid } from './errors';
import type { BillingFrequency, BillingSchedule, Product, QuoteLine } from './types';

const PERIOD_DAYS: Record<BillingFrequency, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function lineNetAmount(line: QuoteLine): number {
  return Math.round(line.listPrice * (1 - line.discountPercent / 100) * line.quantity * 10000) / 10000;
}

export function hybridCommercials(input: {
  lines: QuoteLine[];
  products: Product[];
  taxTotal?: number;
}): {
  oneTimeNet: number;
  recurringMonthly: number;
  recurringYearly: number;
  recurringAnnual: number;
  dueToday: number;
  taxTotal: number;
} {
  let oneTimeNet = 0;
  let recurringMonthly = 0;
  let recurringYearly = 0;
  for (const line of input.lines) {
    const product = input.products.find((item) => item.id === line.productId);
    const net = lineNetAmount(line);
    if (!product || product.billingType !== 'recurring') {
      oneTimeNet += net;
      continue;
    }
    if (product.billingFrequency === 'yearly') recurringYearly += net;
    else if (product.billingFrequency === 'quarterly') recurringMonthly += net / 3;
    else recurringMonthly += net;
  }
  const taxTotal = input.taxTotal ?? 0;
  return {
    oneTimeNet,
    recurringMonthly,
    recurringYearly,
    recurringAnnual: recurringMonthly * 12 + recurringYearly,
    dueToday: oneTimeNet + recurringMonthly + recurringYearly + taxTotal,
    taxTotal,
  };
}

export function buildBillingSchedules(input: {
  quoteId: string;
  lines: QuoteLine[];
  products: Product[];
  now?: Date;
}): BillingSchedule[] {
  const now = input.now ?? new Date();
  return input.lines.map((line) => {
    const product = input.products.find((item) => item.id === line.productId);
    if (!product) {
      throw invalid('Billing requires a product for every line', { quoteLineId: line.id });
    }
    const amount = lineNetAmount(line);
    if (product.billingType === 'recurring') {
      const frequency = product.billingFrequency ?? 'monthly';
      return {
        id: crypto.randomUUID(),
        quoteId: input.quoteId,
        quoteLineId: line.id,
        billingType: 'recurring' as const,
        frequency,
        amount,
        status: 'scheduled' as const,
        nextBillingAt: addDays(now.toISOString(), PERIOD_DAYS[frequency]),
        prorationAmount: 0,
        refundAmount: 0,
      };
    }
    return {
      id: crypto.randomUUID(),
      quoteId: input.quoteId,
      quoteLineId: line.id,
      billingType: 'one_time' as const,
      frequency: null,
      amount,
      status: 'invoiced' as const,
      nextBillingAt: null,
      prorationAmount: 0,
      refundAmount: 0,
    };
  });
}

export function cancelSchedule(input: {
  schedule: BillingSchedule;
  now?: Date;
}): BillingSchedule {
  if (input.schedule.status === 'cancelled') {
    throw conflict('Billing schedule is already cancelled');
  }
  const now = input.now ?? new Date();
  if (input.schedule.billingType !== 'recurring' || !input.schedule.frequency) {
    return {
      ...input.schedule,
      status: 'cancelled',
      cancelledAt: now.toISOString(),
      prorationAmount: 0,
      refundAmount: 0,
    };
  }

  const periodDays = PERIOD_DAYS[input.schedule.frequency];
  const next = input.schedule.nextBillingAt ? new Date(input.schedule.nextBillingAt) : now;
  const periodStart = new Date(next);
  periodStart.setUTCDate(periodStart.getUTCDate() - periodDays);
  const elapsed = Math.max(0, (now.getTime() - periodStart.getTime()) / 86_400_000);
  const remaining = Math.min(periodDays, Math.max(0, periodDays - elapsed));
  const refundAmount = Math.round(input.schedule.amount * (remaining / periodDays) * 100) / 100;
  const prorationAmount = Math.round((input.schedule.amount - refundAmount) * 100) / 100;

  return {
    ...input.schedule,
    status: 'cancelled',
    cancelledAt: now.toISOString(),
    refundAmount,
    prorationAmount,
    nextBillingAt: null,
  };
}
