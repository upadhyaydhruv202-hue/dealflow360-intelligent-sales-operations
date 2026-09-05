import { useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { useOptionalFeatures } from '../features';
import { useRealtime } from '../hooks/useRealtime';
import { getApiErrorMessage } from '../services/api';
import {
  createAutomationRule,
  emitAutomationEvent,
  getAutomationCatalog,
  listAutomationExecutions,
  listAutomationRules,
  setAutomationRuleEnabled,
  type AutomationCatalog,
  type AutomationExecution,
  type AutomationRule,
} from '../services/automation';
import { Alert, Breadcrumb, Button, Card, Input, PageContainer } from '../ui';

export function AutomationsPage() {
  const { accessToken } = useAuth();
  const features = useOptionalFeatures();
  const [catalog, setCatalog] = useState<AutomationCatalog>();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [name, setName] = useState('Remind late invoices');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function withToken<T>(run: (token: string) => Promise<T>): Promise<T | undefined> {
    if (!accessToken) {
      setError('Sign in to continue.');
      return undefined;
    }
    setLoading(true);
    setError(undefined);
    try {
      return await run(accessToken);
    } catch (caught) {
      setError(toErrorMessage(caught));
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  async function refresh(accessToken: string) {
    const [nextCatalog, nextRules, nextExecutions] = await Promise.all([
      getAutomationCatalog(accessToken),
      listAutomationRules(accessToken),
      listAutomationExecutions(accessToken),
    ]);
    setCatalog(nextCatalog);
    setRules(nextRules.items);
    setExecutions(nextExecutions.items);
  }

  useRealtime({
    token: accessToken,
    channels: ['automation'],
    enabled: Boolean(accessToken) && features?.isEnabled('realtime') === true,
    onEvent: (event) => {
      if (event.type !== 'automation.updated') {
        return;
      }
      const payload = event.payload;
      const id = typeof payload.executionId === 'string' ? payload.executionId : event.id;
      const status = isAutomationStatus(payload.status) ? payload.status : 'running';
      setExecutions((current) => [
        {
          id,
          ruleId: typeof payload.ruleId === 'string' ? payload.ruleId : '',
          eventId: event.id,
          trigger: typeof payload.trigger === 'string' ? payload.trigger : '',
          status,
          attempt: typeof payload.attempt === 'number' ? payload.attempt : 0,
          errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : null,
        },
        ...current.filter((item) => item.id !== id),
      ].slice(0, 50));
    },
  });

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Automations' }]} />}
      title="Automations"
      description="Trigger-condition-action workflows. Conditions are declarative operators, not JavaScript. Actions are allowlisted and permission-checked. The scheduler emits scheduled with payload.schedule = tick on the configured interval."
    >
      <SessionGate title="Sign in to manage automations" hint="Manager and admin roles have automations permissions after seed.">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          disabled={loading}
          onClick={() => {
            void withToken(refresh);
          }}
        >
          Load rules
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void withToken(async (accessToken) => {
              await createAutomationRule(
                {
                  name,
                  trigger: 'invoice.overdue',
                  enabled: true,
                  conditions: [{ field: 'daysOverdue', operator: 'greaterThan', value: 7 }],
                  actions: [{ type: 'sendNotification', title: 'Invoice overdue', body: 'Follow up on {{daysOverdue}} days.' }],
                },
                accessToken,
              );
              await refresh(accessToken);
            });
          }}
        >
          Create example rule
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void withToken(async (accessToken) => {
              await createAutomationRule(
                {
                  name: `${name} (scheduled)`,
                  trigger: 'scheduled',
                  enabled: true,
                  conditions: [{ field: 'schedule', operator: 'equals', value: 'tick' }],
                  actions: [{ type: 'createAuditLog', action: 'scheduler.tick' }],
                },
                accessToken,
              );
              await refresh(accessToken);
            });
          }}
        >
          Create scheduled tick rule
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void withToken(async (accessToken) => {
              await emitAutomationEvent(
                {
                  trigger: 'invoice.overdue',
                  payload: { daysOverdue: 10, userId: '11111111-1111-1111-1111-111111111111' },
                },
                accessToken,
              );
              await refresh(accessToken);
            });
          }}
        >
          Emit invoice.overdue
        </Button>
      </div>

      <div className="mb-6 max-w-xl">
        <Input label="Example rule name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      {error ? (
        <Alert variant="error" title="Request failed" className="mb-6">
          {error}
        </Alert>
      ) : null}
      {loading ? <p className="mb-6 text-sm text-foreground-muted">Working…</p> : null}

      {catalog ? (
        <p className="mb-6 text-xs text-foreground-muted">
          Triggers: {catalog.triggers.map((item) => item.name).join(', ')}. Operators:{' '}
          {catalog.operators.join(', ')}.
        </p>
      ) : null}

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Rules</h2>
        {rules.length === 0 ? <p className="text-sm text-foreground-muted">No rules loaded.</p> : null}
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id}>
              <Card className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{rule.name}</p>
                    <p className="text-xs text-foreground-muted">
                      {rule.trigger} · {rule.enabled ? 'enabled' : 'disabled'} · priority {rule.priority}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void withToken(async (accessToken) => {
                        await setAutomationRuleEnabled(rule.id, !rule.enabled, accessToken);
                        await refresh(accessToken);
                      });
                    }}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Executions</h2>
        {executions.length === 0 ? <p className="text-sm text-foreground-muted">No executions yet.</p> : null}
        <ul className="space-y-2">
          {executions.map((execution) => (
            <li key={execution.id}>
              <Card className="text-sm">
                <p className="font-medium text-foreground">{execution.trigger}</p>
                <p className="text-xs text-foreground-muted">
                  {execution.status} · attempt {execution.attempt}
                  {execution.errorMessage ? ` · ${execution.errorMessage}` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      </SessionGate>
    </PageContainer>
  );
}

function toErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, 'The automation request failed');
}

function isAutomationStatus(value: unknown): value is AutomationExecution['status'] {
  return value === 'queued' || value === 'running' || value === 'succeeded' || value === 'failed' || value === 'skipped';
}
