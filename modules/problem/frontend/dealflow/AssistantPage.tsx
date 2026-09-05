import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { getApiErrorMessage } from '@/services/api';
import {
  Alert,
  Badge,
  Breadcrumb,
  Card,
  CardDescription,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  Select,
} from '@/ui';

import { getRecommendations } from './api';
import { DealflowGate, DecisionBadge, HealthBadge, StatusBadge } from './components';
import { formatMoney, formatPercent } from './format';
import { useCatalog, useQuotes } from './hooks';
import { contextualInsights, summarizeDealHealth } from './intelligence';
import type { Recommendation } from './types';

export function AssistantPage() {
  const { accessToken } = useAuth();
  const [params, setParams] = useSearchParams();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const rows = quotes.data ?? [];
  const selectedId = params.get('quote') ?? rows[0]?.id;
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recError, setRecError] = useState<string>();

  useEffect(() => {
    if (!selected || !accessToken) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    void getRecommendations(selected.id, accessToken)
      .then((items) => {
        if (!cancelled) {
          setRecs(items);
          setRecError(undefined);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setRecs([]);
          setRecError(getApiErrorMessage(caught, 'Recommendations are unavailable'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, selected]);

  const insights = useMemo(
    () => (selected ? contextualInsights(selected, catalog.data, recs) : []),
    [catalog.data, recs, selected],
  );
  const health = selected ? summarizeDealHealth(selected) : undefined;

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Assistant' }]} />}
        title="Sales assistant"
        description="Contextual recommendations from the live quote, policy assessment, catalog relations, and stock — not a generic chatbot and not used to set price."
      >
        {quotes.loading ? <LoadingState label="Loading live deals…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error && rows.length === 0 ? (
          <EmptyState
            title="No quotations yet"
            description="Create a quotation so the assistant can score policy, stock, and recommendations."
          />
        ) : null}
        {selected ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-6">
              <Select
                label="Current deal"
                value={selected.id}
                onChange={(event) => setParams({ quote: event.target.value })}
                options={rows.map((item) => ({
                  value: item.id,
                  label: `${item.number} · ${item.customer?.name ?? 'Customer'}`,
                }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-title">
                  {selected.number} · {selected.customer?.name}
                </h2>
                <StatusBadge status={selected.status} />
                <DecisionBadge decision={selected.assessmentDecision} />
                {health ? <HealthBadge health={health} /> : null}
              </div>
              {recError ? <Alert variant="warning">{recError}</Alert> : null}
              <ul className="divide-y divide-edge">
                {insights.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-foreground-muted">{item.detail}</p>
                      </div>
                      <Badge tone={item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : 'info'}>
                        {item.tone}
                      </Badge>
                    </div>
                    {item.href ? (
                      <Link to={item.href} className="mt-2 inline-block text-sm font-medium hover:underline">
                        Open related workspace
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <aside className="space-y-4">
              <Card>
                <CardDescription>Deal snapshot</CardDescription>
                <CardTitle className="mt-1">{formatMoney(selected.netTotal)}</CardTitle>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground-muted">Blended discount</dt>
                    <dd>{formatPercent(selected.blendedDiscountPercent)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground-muted">Margin</dt>
                    <dd>{formatPercent(selected.marginPercent)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground-muted">Win probability</dt>
                    <dd>{health ? `${health.probability}%` : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground-muted">Days in stage</dt>
                    <dd>{health?.daysInStage ?? '—'}</dd>
                  </div>
                </dl>
              </Card>
              <p className="text-caption text-foreground-muted">
                Suggestions use catalog relations and the discount engine. They never execute SQL, Odoo methods, or
                price changes.
              </p>
            </aside>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
