import { describe, expect, it } from 'vitest';

import {
  approvalPriority,
  assessmentForQuoteLine,
  contextualInsights,
  dashboardAnalytics,
  detectAnomalies,
  hybridCommercials,
  liveLineNet,
  portalStatusLabel,
  previewUnitPrice,
  summarizeDealHealth,
} from './intelligence';
import { SAMPLE_QUOTE } from './test-fixtures';
import type { DealflowCatalog, QuoteView } from './types';

const catalog: DealflowCatalog = {
  customers: [SAMPLE_QUOTE.customer],
  products: SAMPLE_QUOTE.lines[0].product ? [SAMPLE_QUOTE.lines[0].product] : [],
  warehouses: [{ id: 'west', name: 'West DC', fulfillmentCostPerUnit: 18 }],
  stock: [
    {
      warehouseId: 'west',
      productId: SAMPLE_QUOTE.lines[0].productId,
      quantityOnHand: 4,
      reserved: 0,
    },
  ],
  policies: [],
  chains: [],
  governance: {
    cumulativeWarningLimit: 2,
    materialDiscountDeltaPp: 2,
    materialTotalDeltaRatio: 0.1,
    highValueNetTotal: 25000,
    maxApprovalLevels: 3,
    unusualDiscountPercent: 10,
  },
};

describe('deal intelligence', () => {
  it('scores an approval-required high-risk quote as critical', () => {
    const health = summarizeDealHealth(SAMPLE_QUOTE, Date.parse('2026-09-08T05:10:00.000Z'));
    expect(health.level).toBe('critical');
    expect(health.score).toBeLessThan(75);
    expect(health.factors.some((item) => item.id === 'approval')).toBe(true);
    expect(health.probability).toBe(42);
  });

  it('detects discount, stock, and aging approval anomalies', () => {
    const anomalies = detectAnomalies([SAMPLE_QUOTE], catalog, Date.parse('2026-09-08T05:10:00.000Z'));
    expect(anomalies.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        `${SAMPLE_QUOTE.id}-discount`,
        `${SAMPLE_QUOTE.id}-sla`,
        `${SAMPLE_QUOTE.id}-stock-${SAMPLE_QUOTE.lines[0].id}`,
      ]),
    );
  });

  it('builds contextual insights from assessment and recommendations', () => {
    const insights = contextualInsights(SAMPLE_QUOTE, catalog, [
      {
        relationId: 'rel-1',
        kind: 'cross_sell',
        product: {
          id: 'edge',
          sku: 'HW-EDGE-2',
          name: 'Edge Sensor Pack',
          category: 'hardware',
          listPrice: 900,
          cost: 400,
          billingType: 'one_time',
        },
        reason: 'Pairs with Core Gateway deployments.',
        priceImpact: 900,
        marginImpact: 500,
      },
    ]);
    expect(insights.some((item) => item.title.includes('approval is still pending'))).toBe(true);
    expect(insights.some((item) => item.title.includes('Edge Sensor Pack'))).toBe(true);
  });

  it('computes conversion, forecast, and hybrid commercial totals', () => {
    const won: QuoteView = {
      ...SAMPLE_QUOTE,
      id: 'won',
      status: 'confirmed',
      assessmentDecision: 'allowed',
      riskScore: 10,
      lines: [
        SAMPLE_QUOTE.lines[0],
        {
          ...SAMPLE_QUOTE.lines[0],
          id: 'line-sw',
          productId: 'sw',
          listPrice: 2400,
          quantity: 1,
          discountPercent: 16,
          product: {
            id: 'sw',
            sku: 'SW-CTRL-1',
            name: 'Control Suite',
            category: 'software',
            listPrice: 2400,
            cost: 400,
            billingType: 'recurring',
            billingFrequency: 'monthly',
          },
        },
      ],
    };
    const analytics = dashboardAnalytics([SAMPLE_QUOTE, won]);
    expect(analytics.conversion).toBe(50);
    expect(analytics.forecast).toBeGreaterThan(0);
    const hybrid = hybridCommercials(won);
    expect(hybrid.mixed).toBe(true);
    expect(hybrid.oneTimeNet).toBe(26880);
    expect(hybrid.recurringMonthly).toBeCloseTo(2016);
  });

  it('previews quantity-break prices and explains a price change', () => {
    const product = SAMPLE_QUOTE.lines[0].product!;
    const list = previewUnitPrice(product, 9, [
      {
        id: 'b1',
        name: 'Core Gateway 1–9 list',
        productId: product.id,
        minQuantity: 1,
        maxQuantity: 9,
        adjustmentKind: 'fixed',
        adjustmentValue: 4000,
      },
      {
        id: 'b2',
        name: 'Core Gateway 10–49 volume',
        productId: product.id,
        minQuantity: 10,
        maxQuantity: 49,
        adjustmentKind: 'fixed',
        adjustmentValue: 3700,
      },
    ]);
    const volume = previewUnitPrice(product, 10, [
      {
        id: 'b1',
        name: 'Core Gateway 1–9 list',
        productId: product.id,
        minQuantity: 1,
        maxQuantity: 9,
        adjustmentKind: 'fixed',
        adjustmentValue: 4000,
      },
      {
        id: 'b2',
        name: 'Core Gateway 10–49 volume',
        productId: product.id,
        minQuantity: 10,
        maxQuantity: 49,
        adjustmentKind: 'fixed',
        adjustmentValue: 3700,
      },
    ]);
    expect(list.unitPrice).toBe(4000);
    expect(volume.unitPrice).toBe(3700);
    expect(volume.ruleName).toContain('10–49');

    const insights = contextualInsights(
      {
        ...SAMPLE_QUOTE,
        assessment: {
          ...SAMPLE_QUOTE.assessment!,
          lines: [
            {
              ...SAMPLE_QUOTE.assessment!.lines[0],
              quantity: 10,
              basePrice: 4000,
              appliedPrice: 3700,
              pricingRuleName: 'Core Gateway 10–49 volume',
            },
          ],
        },
      },
      catalog,
      [],
    );
    expect(insights.some((item) => item.title.includes('Why did HW-CORE-1 price change'))).toBe(true);
  });

  it('maps portal-facing status labels without exposing internals', () => {
    expect(portalStatusLabel('draft')).toBe('Sent');
    expect(portalStatusLabel('customer_negotiation')).toBe('Under Negotiation');
    expect(portalStatusLabel('approved')).toBe('Confirmed');
    expect(approvalPriority(SAMPLE_QUOTE, Date.parse('2026-09-08T05:10:00.000Z'))).toBe('critical');
  });

  it('matches assessment by quote line id so duplicate SKUs keep their own net', () => {
    const first = SAMPLE_QUOTE.lines[0];
    const second = {
      ...first,
      id: 'line-hw-2',
      quantity: 2,
      discountPercent: 4,
    };
    const quote: QuoteView = {
      ...SAMPLE_QUOTE,
      lines: [first, second],
      assessment: {
        ...SAMPLE_QUOTE.assessment!,
        lines: [
          { ...SAMPLE_QUOTE.assessment!.lines[0], lineId: first.id, quantity: 8, netAmount: 26880 },
          {
            ...SAMPLE_QUOTE.assessment!.lines[0],
            lineId: second.id,
            quantity: 2,
            discountPercent: 4,
            listAmount: 8000,
            netAmount: 7680,
          },
        ],
      },
    };

    expect(assessmentForQuoteLine(quote, first)?.netAmount).toBe(26880);
    expect(assessmentForQuoteLine(quote, second)?.netAmount).toBe(7680);
    expect(liveLineNet(first, assessmentForQuoteLine(quote, first))).toBe(26880);
    expect(liveLineNet(second, assessmentForQuoteLine(quote, second))).toBe(7680);
    expect(liveLineNet(second, assessmentForQuoteLine(quote, second))).toBe(7680);
    expect(liveLineNet(second, assessmentForQuoteLine(quote, first), { quantity: 1, discountPercent: 4 })).toBe(3840);
  });
});
