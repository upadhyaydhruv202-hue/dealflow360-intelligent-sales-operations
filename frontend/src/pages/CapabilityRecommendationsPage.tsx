import { useEffect, useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import {
  recommendCapabilities,
  type CapabilityRecommendationResult,
  type RecommendationItem,
} from '../services/capability-recommendations';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  AiConfidenceBadge,
  PageContainer,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

export const ANALYSIS_STORAGE_KEY = 'hsk.capability-recommendation-analysis';

const EXAMPLE = `{
  "problemSummary": "Staff look up customer records by name in a logged-in web app.",
  "mappings": [
    {
      "requirement": "Users search customer records by name",
      "category": "data",
      "existingCapability": "database",
      "newProblemLogic": "unknown",
      "confidence": 0.91
    }
  ]
}`;

const STATUS_TONE: Record<RecommendationItem['status'], 'success' | 'info' | 'warning'> = {
  recommended: 'success',
  baseline: 'info',
  not_recommended: 'warning',
};

export function CapabilityRecommendationsPage() {
  const { accessToken } = useAuth();
  const [raw, setRaw] = useState(EXAMPLE);
  const [result, setResult] = useState<CapabilityRecommendationResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const stored = sessionStorage.getItem(ANALYSIS_STORAGE_KEY);
    if (stored) {
      setRaw(stored);
    }
  }, []);

  async function recommend() {
    if (!accessToken) {
      setError('Sign in to generate recommendations.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const analysis = JSON.parse(raw) as unknown;
      const data = await recommendCapabilities({ analysis }, accessToken);
      setResult(data);
    } catch (caught) {
      if (caught instanceof SyntaxError) {
        setError('Analysis JSON is invalid.');
      } else {
        setError(getApiErrorMessage(caught, 'The recommendation request failed'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Capability recommendations' }]} />}
      title="Capability recommendations"
      description="Paste a structured problem analysis. The engine maps it to catalog capabilities, profiles, adapters, and modes. Recommendations are advisory. Nothing is enabled automatically."
    >
      <SessionGate
        title="Sign in to recommend capabilities"
        hint="Manager and admin roles have capabilities.recommend after seed."
      >
        <form
          className="mb-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void recommend();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="capability-analysis">
              Structured analysis JSON
            </label>
            <textarea
              id="capability-analysis"
              className={`${controlBase} mt-1 min-h-48 font-mono text-xs`}
              value={raw}
              disabled={loading || !accessToken}
              onChange={(event) => setRaw(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading || !accessToken} loading={loading}>
            Recommend capabilities
          </Button>
        </form>

        {error ? (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        ) : null}
        {result ? <CapabilityRecommendationResults result={result} /> : null}
      </SessionGate>
    </PageContainer>
  );
}

export function CapabilityRecommendationResults({ result }: { result: CapabilityRecommendationResult }) {
  const groups: Array<{ title: string; items: RecommendationItem[] }> = [
    { title: 'Architecture and deployment', items: [result.architectureMode, result.deploymentMode] },
    { title: 'Profiles', items: result.profiles },
    { title: 'Capabilities', items: result.capabilities },
    { title: 'Adapters', items: result.adapters },
    { title: 'Infrastructure', items: result.infrastructure },
    { title: 'Not recommended', items: result.rejected },
  ];

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        Advisory only. Human selection remains authoritative. Nothing was enabled and FEATURE_* was not
        changed.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Selected set</CardTitle>
          <AiConfidenceBadge value={result.confidence} />
        </CardHeader>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-foreground-muted">Architecture</dt>
            <dd className="font-medium">{result.selected.architectureMode}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Deployment</dt>
            <dd className="font-medium">{result.selected.deploymentMode}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Profiles</dt>
            <dd>{result.selected.profiles.join(', ') || 'none'}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Resolver</dt>
            <dd>{result.resolution.valid ? 'valid closed set' : `${result.resolution.issueCount} issue(s)`}</dd>
          </div>
        </dl>
      </Card>

      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <ul className="space-y-3">
              {group.items.map((item) => (
                <RecommendationRow key={item.id} item={item} />
              ))}
            </ul>
          </Card>
        ),
      )}

      {result.notes.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function RecommendationRow({ item }: { item: RecommendationItem }) {
  return (
    <li className="rounded-lg border border-edge p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[item.status]}>{item.status.replace(/_/g, ' ')}</Badge>
        <span className="text-xs uppercase tracking-wide text-foreground-muted">{item.kind}</span>
        <AiConfidenceBadge value={item.confidence} />
      </div>
      <p className="text-sm font-medium text-foreground">{item.capabilitySelected}</p>
      <p className="mt-1 text-xs text-foreground-muted">Requirement: {item.requirementSatisfied}</p>
      <p className="text-xs text-foreground">{item.reason}</p>
      <p className="mt-1 text-xs text-foreground-muted">
        Dependencies: {item.dependencyImpact.adds.join(', ') || 'none'} · optional{' '}
        {item.dependencyImpact.optional.join(', ') || 'none'}
      </p>
      <p className="text-xs text-foreground-muted">
        Complexity {item.complexityImpact} · security {item.securityImpact}
      </p>
      <p className="text-xs text-foreground-muted">
        Alternative: {item.alternative.name} — {item.alternative.reason}
      </p>
    </li>
  );
}
