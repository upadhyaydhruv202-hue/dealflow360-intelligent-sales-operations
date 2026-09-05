import { ANALYTICS } from '../../constants';
import type { AnalyticsFactInput } from './analytics.types';

const STATUSES = ['open', 'closed'] as const;
const CATEGORIES = ['ops', 'support'] as const;

/**
 * Generic demo facts for the last 14 UTC days. Values are placeholders, not product KPIs.
 */
export function buildDemoAnalyticsFacts(now = new Date()): AnalyticsFactInput[] {
  const facts: AnalyticsFactInput[] = [];
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13, 9, 0, 0, 0),
  );

  for (let day = 0; day < 14; day += 1) {
    for (let slot = 0; slot < 3; slot += 1) {
      const occurredAt = new Date(start.getTime() + day * 24 * 60 * 60 * 1000 + slot * 3 * 60 * 60 * 1000);
      const status = STATUSES[(day + slot) % STATUSES.length];
      const category = CATEGORIES[day % CATEGORIES.length];
      const value = 4 + ((day + slot) % 5);

      facts.push({
        kpi: ANALYTICS.DEMO_EVENTS_KPI,
        source: ANALYTICS.DEMO_SOURCE,
        eventId: `demo-event-${day}-${slot}`,
        occurredAt,
        value: 1,
        dimensions: { status, category },
      });
      facts.push({
        kpi: ANALYTICS.DEMO_VALUE_KPI,
        source: ANALYTICS.DEMO_SOURCE,
        eventId: `demo-value-${day}-${slot}`,
        occurredAt,
        value,
        dimensions: { status, category },
      });
    }
  }

  return facts;
}
