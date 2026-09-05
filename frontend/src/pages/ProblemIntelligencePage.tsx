import { useState } from 'react';
import { Link } from 'react-router-dom';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import {
  analyzeProblemStatement,
  type ActorItem,
  type ClassifiedMapping,
  type EntityItem,
  type NamedItem,
  type OdooRequirementItem,
  type ProblemIntelligenceResult,
  type RequirementClassification,
  type Unknownable,
  type UnknownableList,
  type WorkflowItem,
} from '../services/problem-intelligence';
import { recommendCapabilities, type CapabilityRecommendationResult } from '../services/capability-recommendations';
import { ANALYSIS_STORAGE_KEY, CapabilityRecommendationResults } from './CapabilityRecommendationsPage';
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

const EXAMPLE = `Staff in a warehouse must log in and record damaged inventory. A manager reviews each record on a dashboard. If the statement mentions Odoo, sync product quantities. Do not invent models that are not named.`;

const CLASSIFICATION_TONE: Record<RequirementClassification, 'success' | 'info' | 'warning' | 'neutral'> = {
  existing_capability: 'success',
  new_problem_logic: 'info',
  both: 'warning',
  unknown: 'neutral',
};

export function ProblemIntelligencePage() {
  const { accessToken } = useAuth();
  const [statement, setStatement] = useState(EXAMPLE);
  const [result, setResult] = useState<ProblemIntelligenceResult>();
  const [recommendations, setRecommendations] = useState<CapabilityRecommendationResult>();
  const [recommending, setRecommending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function analyze() {
    if (!accessToken) {
      setError('Sign in to analyze a problem statement.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setResult(await analyzeProblemStatement({ statement }, accessToken));
      setRecommendations(undefined);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The analysis request failed'));
    } finally {
      setLoading(false);
    }
  }

  async function recommendFromAnalysis() {
    if (!accessToken || !result) {
      setError('Analyze a statement before requesting recommendations.');
      return;
    }
    setRecommending(true);
    setError(undefined);
    try {
      sessionStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(result));
      setRecommendations(await recommendCapabilities({ analysis: result, title: result.title ?? undefined }, accessToken));
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The recommendation request failed'));
    } finally {
      setRecommending(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Problem intelligence' }]} />}
      title="Problem statement intelligence"
      description="Paste a hackathon problem statement. The backend asks the model for structured JSON, validates it, then classifies each requirement against the platform catalog. The model cannot execute tools, SQL, Odoo, HTTP, or filesystem access. Treat the result as a draft."
    >
      <SessionGate
        title="Sign in to analyze a problem statement"
        hint="Manager and admin roles have problem.analyze after seed."
      >
        <form
          className="mb-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void analyze();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="problem-statement">
              Problem statement
            </label>
            <textarea
              id="problem-statement"
              className={`${controlBase} mt-1 min-h-40`}
              value={statement}
              maxLength={50_000}
              disabled={loading || !accessToken}
              onChange={(event) => setStatement(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading || !accessToken} loading={loading}>
            Analyze statement
          </Button>
        </form>

        {error ? (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        ) : null}
        {result ? <AnalysisResult result={result} /> : null}
        {result ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={recommending || !accessToken}
              loading={recommending}
              onClick={() => void recommendFromAnalysis()}
            >
              Recommend capabilities
            </Button>
            <Link className="text-sm text-accent underline" to="/capability-recommendations">
              Open recommendation page
            </Link>
          </div>
        ) : null}
        {recommendations ? (
          <div className="mt-6">
            <CapabilityRecommendationResults result={recommendations} />
          </div>
        ) : null}
      </SessionGate>
    </PageContainer>
  );
}

function AnalysisResult({ result }: { result: ProblemIntelligenceResult }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Problem summary</CardTitle>
          <div className="flex flex-wrap gap-2">
            <AiConfidenceBadge value={result.confidence} />
            {result.requiresReview ? <Badge tone="warning">Needs review</Badge> : <Badge tone="success">Reviewed draft</Badge>}
            {result.injection.suspicious ? <Badge tone="danger">Injection signals</Badge> : null}
          </div>
        </CardHeader>
        <p className="text-sm text-foreground">{unknownText(result.spec.problemSummary)}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SpecList title="Users" list={result.spec.users} render={namedLine} />
        <SpecList title="Actors" list={result.spec.actors} render={actorLine} />
        <SpecList title="Workflows" list={result.spec.workflows} render={workflowLine} />
        <SpecList title="Entities" list={result.spec.entities} render={entityLine} />
        <SpecList title="Business rules" list={result.spec.businessRules} render={namedLine} />
        <SpecList title="Integrations" list={result.spec.integrations} render={namedLine} />
        <SpecList title="Odoo requirements" list={result.spec.odooRequirements} render={odooLine} />
        <SpecList title="AI requirements" list={result.spec.aiRequirements} render={namedLine} />
        <SpecList title="Automation requirements" list={result.spec.automationRequirements} render={namedLine} />
        <SpecList title="Notifications" list={result.spec.notifications} render={namedLine} />
        <SpecList title="Documents" list={result.spec.documents} render={namedLine} />
        <SpecList title="Reports" list={result.spec.reports} render={namedLine} />
        <SpecList title="Security requirements" list={result.spec.securityRequirements} render={namedLine} />
        <SpecList title="Non-functional requirements" list={result.spec.nonFunctionalRequirements} render={namedLine} />
        <SpecList title="Likely data requirements" list={result.spec.likelyDataRequirements} render={namedLine} />
        <SpecList title="Likely infrastructure requirements" list={result.spec.likelyInfrastructureRequirements} render={namedLine} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requirement → existing capability → new problem logic</CardTitle>
        </CardHeader>
        {result.mappings.length === 0 ? (
          <p className="text-sm text-foreground-muted">unknown</p>
        ) : (
          <ul className="space-y-3">
            {result.mappings.map((mapping) => (
              <MappingRow key={`${mapping.category}-${mapping.requirement}`} mapping={mapping} />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Existing platform capabilities</CardTitle>
          </CardHeader>
          {result.existingCapabilities.length === 0 ? (
            <p className="text-sm text-foreground-muted">None classified from the catalog.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {result.existingCapabilities.map((item) => (
                <li key={item.name}>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-foreground-muted"> — {item.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New problem-specific logic</CardTitle>
          </CardHeader>
          {result.newProblemLogic.length === 0 ? (
            <p className="text-sm text-foreground-muted">None identified.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {result.newProblemLogic.map((item) => (
                <li key={item.requirement}>
                  <span className="font-medium">{item.requirement}</span>
                  <span className="text-foreground-muted"> — {item.logic}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {result.unknowns.length || result.uncertainty.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Unknowns and uncertainty</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {[...result.unknowns, ...result.uncertainty].map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function SpecList<T>({
  title,
  list,
  render,
}: {
  title: string;
  list: UnknownableList<T> | undefined;
  render: (item: T) => string;
}) {
  const resolved = list ?? { determined: false, items: [] };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {!resolved.determined ? (
        <p className="text-sm text-foreground-muted">unknown</p>
      ) : resolved.items.length === 0 ? (
        <p className="text-sm text-foreground-muted">None identified.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {resolved.items.map((item, index) => (
            <li key={`${title}-${index}`}>{render(item)}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MappingRow({ mapping }: { mapping: ClassifiedMapping }) {
  return (
    <li className="rounded-lg border border-edge p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={CLASSIFICATION_TONE[mapping.classification]}>{mapping.classification.replace(/_/g, ' ')}</Badge>
        <span className="text-xs uppercase tracking-wide text-foreground-muted">{mapping.category}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{mapping.requirement}</p>
      <p className="mt-1 text-xs text-foreground-muted">
        Existing: {mapping.existingCapability?.name ?? 'unknown'}
        {mapping.hallucinatedCapability ? ` (rejected ${mapping.hallucinatedCapability})` : ''}
      </p>
      <p className="text-xs text-foreground-muted">New problem logic: {mapping.newProblemLogic ?? 'unknown'}</p>
    </li>
  );
}

function unknownText(value: Unknownable<string> | undefined): string {
  return !value || value === 'unknown' ? 'unknown' : value;
}

function unknownList(value: Unknownable<string[]> | undefined): string {
  if (!value || value === 'unknown' || value.length === 0) {
    return 'unknown';
  }
  return value.join(', ');
}

function namedLine(item: NamedItem): string {
  return `${item.name} — ${unknownText(item.description)}`;
}

function actorLine(item: ActorItem): string {
  return `${unknownText(item.name)} (${item.kind}) — ${unknownText(item.description)}`;
}

function workflowLine(item: WorkflowItem): string {
  return `${unknownText(item.name)} — steps: ${unknownList(item.steps)}; actors: ${unknownList(item.actors)}`;
}

function entityLine(item: EntityItem): string {
  return `${unknownText(item.name)} — fields: ${unknownList(item.fields)}; ${unknownText(item.description)}`;
}

function odooLine(item: OdooRequirementItem): string {
  return `${unknownText(item.app)} / ${unknownText(item.model)} (${item.operation}) — ${unknownText(item.notes)}`;
}
