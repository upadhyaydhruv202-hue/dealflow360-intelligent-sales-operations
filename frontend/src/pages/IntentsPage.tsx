import { useEffect, useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import {
  executeIntent,
  listIntents,
  type IntentDescriptor,
  type IntentExecuteResult,
} from '../services/intents';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  AiConfidenceBadge,
  EvidencePanel,
  PageContainer,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

const EXAMPLES = [
  'Show pending orders above ₹50,000 this month.',
  'Find active customers named Contoso',
  'Get invoice inv-9001',
  'Summarize customer cust-1001',
  'Create a task to call Contoso',
  'Delete order ord-5003',
];

export function IntentsPage() {
  const { accessToken } = useAuth();
  const [utterance, setUtterance] = useState(EXAMPLES[0]);
  const [catalog, setCatalog] = useState<IntentDescriptor[]>([]);
  const [result, setResult] = useState<IntentExecuteResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void listIntents(accessToken)
      .then((data) => setCatalog(data.intents))
      .catch((caught) => setError(getApiErrorMessage(caught, 'Could not load intents')));
  }, [accessToken]);

  async function run(input: { utterance?: string; confirm?: boolean; confirmationToken?: string }) {
    if (!accessToken) {
      setError('Sign in to run a business action.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const next = await executeIntent(input, accessToken);
      setResult(next);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The intent request failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Actions' }]} />}
      title="Business actions"
      description="Describe an operation in natural language. The backend extracts a registered intent, validates the payload, checks permissions, and requires confirmation for deletes, bulk updates, external messages, and financial actions. It cannot run SQL, shell, HTTP, or arbitrary Odoo methods."
    >
      <SessionGate
        title="Sign in to run business actions"
        hint="Manager and admin roles have intents.use after seed."
      >
        <form
          className="mb-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run({ utterance });
          }}
        >
          <div>
            <label className={labelClass} htmlFor="intent-utterance">
              What should the app do?
            </label>
            <textarea
              id="intent-utterance"
              className={`${controlBase} mt-1 min-h-24`}
              value={utterance}
              disabled={loading || !accessToken}
              onChange={(event) => setUtterance(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-edge px-3 py-1 text-xs text-foreground-muted hover:bg-surface-muted"
                onClick={() => setUtterance(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={loading || !accessToken} loading={loading}>
            Run action
          </Button>
        </form>

        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
        {result ? <IntentResultCard result={result} loading={loading} onConfirm={() => void run({ confirm: true, confirmationToken: result.confirmationToken })} /> : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registered intents</CardTitle>
          </CardHeader>
          {catalog.length === 0 ? (
            <p className="text-sm text-foreground-muted">No intents registered. Enable FEATURE_INTENTS and demo mode, or register intents from modules/problem.</p>
          ) : (
            <ul className="space-y-3">
              {catalog.map((intent) => (
                <li key={intent.name} className="rounded-lg border border-edge px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-sm font-semibold">{intent.name}</code>
                    <Badge tone={intent.requiresConfirmation ? 'warning' : 'neutral'}>{intent.riskLevel}</Badge>
                    {intent.highRiskClass ? <Badge tone="danger">{intent.highRiskClass}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">{intent.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </SessionGate>
    </PageContainer>
  );
}

function IntentResultCard({
  result,
  loading,
  onConfirm,
}: {
  result: IntentExecuteResult;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Parsed command</CardTitle>
        <Badge tone={statusTone(result.status)}>{result.status.replaceAll('_', ' ')}</Badge>
        {result.confidence != null ? <AiConfidenceBadge value={result.confidence} /> : null}
      </div>
      {result.command ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">
          {JSON.stringify(result.command, null, 2)}
        </pre>
      ) : null}
      {result.error ? <Alert variant="error">{result.error}</Alert> : null}
      {result.clarification ? <p className="text-sm">{result.clarification}</p> : null}
      {result.candidates && result.candidates.length > 0 ? (
        <p className="text-xs text-foreground-muted">Candidates: {result.candidates.join(', ')}</p>
      ) : null}
      <EvidencePanel items={result.evidence ? [result.evidence] : undefined} />
      {result.result !== undefined ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">
          {JSON.stringify(result.result, null, 2)}
        </pre>
      ) : null}
      {result.status === 'pending_confirmation' && result.confirmationToken ? (
        <Button variant="danger" disabled={loading} onClick={onConfirm}>
          Confirm action
        </Button>
      ) : null}
    </Card>
  );
}

function statusTone(status: IntentExecuteResult['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') {
    return 'success';
  }
  if (status === 'pending_confirmation' || status === 'ambiguous') {
    return 'warning';
  }
  if (status === 'denied' || status === 'invalid' || status === 'error') {
    return 'danger';
  }
  return 'neutral';
}
