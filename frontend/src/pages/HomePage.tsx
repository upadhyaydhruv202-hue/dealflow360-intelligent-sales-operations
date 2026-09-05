import { API_PATHS, OPERATIONAL_PATHS } from '@hackathon/api-contract';
import { useEffect, useState } from 'react';

import { FEATURE_NAMES, useFeatures } from '../features';
import { ApiClientError } from '../services/api';
import { getHealth, getReadiness } from '../services/health';
import type { HealthData, ReadinessData } from '../types/api';
import { Badge, Breadcrumb, Card, CardHeader, CardTitle, ErrorState, LoadingState, PageContainer } from '../ui';

interface ProbeState<T> {
  loading: boolean;
  data?: T;
  error?: string;
}

const initialState = { loading: true } as const;

export function HomePage() {
  const { ready, isDemo, isEnabled } = useFeatures();
  const [health, setHealth] = useState<ProbeState<HealthData>>(initialState);
  const [readiness, setReadiness] = useState<ProbeState<ReadinessData>>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getHealth();
        if (!cancelled) setHealth({ loading: false, data });
      } catch (error) {
        if (!cancelled) {
          setHealth({ loading: false, error: toErrorMessage(error) });
        }
      }

      try {
        const data = await getReadiness();
        if (!cancelled) setReadiness({ loading: false, data });
      } catch (error) {
        if (!cancelled) {
          setReadiness({ loading: false, error: toErrorMessage(error) });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home' }]} />}
      title="Foundation is running"
      description={
        <>
          This starter kit provides configuration, API conventions, health checks, and extension points. Add
          hackathon-specific features under <code className="rounded bg-surface-muted px-1">modules/problem</code>.
          Keep reusable infrastructure generic.
        </>
      }
    >
      <p className="mb-6 text-sm font-medium uppercase tracking-wide text-foreground-muted">Reusable platform</p>
      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
            <a className="text-xs text-foreground-muted underline" href={API_PATHS.features}>
              {API_PATHS.features}
            </a>
          </CardHeader>
          {!ready ? <LoadingState label="Loading flags…" className="py-4" /> : null}
          {ready ? (
            <div className="space-y-2">
              <p className="text-sm">
                {isDemo() ? (
                  <Badge tone="warning">Demo mode</Badge>
                ) : (
                  <Badge tone="neutral">Production mode</Badge>
                )}
              </p>
              <p className="text-xs text-foreground-muted">
                Server evaluation is authoritative. This list is UX only.
              </p>
              <ul className="flex flex-wrap gap-2">
                {FEATURE_NAMES.filter((name) => isEnabled(name)).map((name) => (
                  <li key={name}>
                    <Badge tone="success">{name}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <StatusCard title="Health" href={OPERATIONAL_PATHS.health} state={health} readyLabel="Application is up" />
        <StatusCard
          title="Readiness"
          href={OPERATIONAL_PATHS.ready}
          state={readiness}
          readyLabel="Configured dependencies are reachable"
        />
      </section>
    </PageContainer>
  );
}

function StatusCard<T extends { status: string }>({
  title,
  href,
  state,
  readyLabel,
}: {
  title: string;
  href: string;
  state: ProbeState<T>;
  readyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <a className="text-xs text-foreground-muted underline" href={href}>
          {href}
        </a>
      </CardHeader>
      {state.loading ? <LoadingState label="Checking…" className="py-4" /> : null}
      {state.data ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-success">{state.data.status}</p>
          <p className="text-xs text-foreground-muted">{readyLabel}</p>
        </div>
      ) : null}
      {state.error ? <ErrorState message={state.error} className="border-0 bg-transparent px-0 py-2" /> : null}
    </Card>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to reach the API';
}
