import { useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import { evaluateAnomaly, type AnomalyInsight } from '../services/anomaly';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EvidencePanel,
  PageContainer,
  SimpleLineChart,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

const STABLE = [100, 101, 99, 100, 102, 98, 100, 101, 99, 100];
const HIGH_DROP = [100, 101, 99, 102, 98, 100, 101, 99, 100, 76.6];
const LOW_DROP = [100, 101, 99, 100, 102, 98, 100, 101, 99, 89];
const SHORT = [100, 70];

const SAMPLES: Array<{ id: string; label: string; points: number[] }> = [
  { id: 'stable', label: 'No anomaly (stable sales)', points: STABLE },
  { id: 'low', label: 'Low drop (~10%)', points: LOW_DROP },
  { id: 'high', label: 'High drop (−23.4%)', points: HIGH_DROP },
  { id: 'short', label: 'Insufficient data (2 points)', points: SHORT },
];

function severityTone(severity: AnomalyInsight['severity']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (severity === 'HIGH') return 'danger';
  if (severity === 'MEDIUM' || severity === 'LOW') return 'warning';
  return 'success';
}

export function AnomalyPage() {
  const { accessToken } = useAuth();
  const [metric, setMetric] = useState('sales');
  const [sampleId, setSampleId] = useState('high');
  const [explain, setExplain] = useState(true);
  const [result, setResult] = useState<AnomalyInsight>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const sample = SAMPLES.find((item) => item.id === sampleId) ?? SAMPLES[2];
  const points = sample.points;

  async function run() {
    if (!accessToken) {
      setError('Sign in to evaluate a series.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setResult(
        await evaluateAnomaly(
          {
            metric,
            points,
            explain: sampleId === 'short' ? false : explain,
            detectors:
              sampleId === 'short'
                ? {
                    threshold: { enabled: false },
                    percentChange: { enabled: false },
                    movingAverage: { enabled: false },
                    frequency: { enabled: false },
                    trend: { enabled: false },
                    zScore: { enabled: true },
                  }
                : sampleId === 'low'
                  ? {
                      zScore: { enabled: false },
                      frequency: { enabled: false },
                      movingAverage: { enabled: false },
                      trend: { enabled: false },
                    }
                  : undefined,
          },
          accessToken,
        ),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Anomaly evaluation failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Anomalies' }]} />}
      title="Anomaly insights"
      description="Statistical detectors flag unusual series. AI only explains the measured result. It does not decide whether a number is anomalous, and it does not claim statistical significance."
    >
      <SessionGate
        title="Sign in to evaluate series"
        hint="Manager and admin roles have anomaly.use after seed."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Series</CardTitle>
            </CardHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              <div>
                <label className={labelClass} htmlFor="anomaly-metric">
                  Metric
                </label>
                <input
                  id="anomaly-metric"
                  className={`${controlBase} mt-1`}
                  value={metric}
                  disabled={loading || !accessToken}
                  onChange={(event) => setMetric(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="anomaly-sample">
                  Sample
                </label>
                <select
                  id="anomaly-sample"
                  className={`${controlBase} mt-1`}
                  value={sampleId}
                  disabled={loading || !accessToken}
                  onChange={(event) => setSampleId(event.target.value)}
                >
                  {SAMPLES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={explain}
                  disabled={loading || !accessToken || sampleId === 'short'}
                  onChange={(event) => setExplain(event.target.checked)}
                />
                Ask AI to explain (after detection)
              </label>
              <Button type="submit" disabled={loading || !accessToken} loading={loading}>
                Evaluate series
              </Button>
            </form>
            <div className="mt-4">
              <SimpleLineChart
                title={`${metric} sample`}
                data={points.map((value, index) => ({ label: String(index + 1), value }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            {error ? (
              <Alert variant="error" className="mb-3">
                {error}
              </Alert>
            ) : null}
            {result ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={result.anomaly ? 'danger' : 'success'}>
                    {result.anomaly ? 'anomaly' : 'no anomaly'}
                  </Badge>
                  <Badge tone={severityTone(result.severity)}>{result.severity}</Badge>
                  {result.change !== null ? (
                    <Badge tone="neutral">change {result.change}%</Badge>
                  ) : null}
                  <Badge tone="neutral">{result.explanationStatus}</Badge>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{result.metric}</span>
                  {result.evidence.insufficientData ? ' — not enough observations for the selected detectors.' : null}
                </p>
                <EvidencePanel title="Measured evidence">
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    <li>sample size {result.evidence.sampleSize}</li>
                    <li>latest {result.evidence.latest}</li>
                    <li>baseline {result.evidence.baseline ?? 'n/a'}</li>
                    <li>fired: {result.evidence.fired.join(', ') || 'none'}</li>
                    <li>statistical significance claimed: no</li>
                  </ul>
                </EvidencePanel>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    AI explanation
                  </p>
                  <p className="mt-1 text-sm">{result.explanation}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Recommended action
                  </p>
                  <p className="mt-1 text-sm">{result.recommendedAction}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">Run a sample series to see detection and explanation.</p>
            )}
          </Card>
        </div>
      </SessionGate>
    </PageContainer>
  );
}
