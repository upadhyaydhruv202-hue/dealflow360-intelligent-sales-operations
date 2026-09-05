import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import { getCapabilities, type CatalogCapability, type CatalogProfile } from '../services/capabilities';
import type { CapabilityRecommendationResult } from '../services/capability-recommendations';
import {
  PROJECT_CONFIGURATION_STORAGE_KEY,
  analyzeProjectPlanning,
  approveProjectPlanning,
  validateProjectPlanning,
  type ProjectConfiguration,
  type ProjectPlanningSelection,
} from '../services/project-planning';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  PageContainer,
  RadioGroup,
  Search,
  Select,
  AiConfidenceBadge,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

const STEPS = [
  { id: 'problem', label: 'Problem' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'selection', label: 'Selection' },
  { id: 'review', label: 'Review' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const EXAMPLE =
  'Staff in a warehouse must log in and search inventory records by name. A manager reviews results on a dashboard. Keep the architecture a modular monolith on local-hybrid deployment.';

const ARCHITECTURE_OPTIONS = [
  { value: 'architecture.modular-monolith', label: 'Modular monolith', hint: 'Default. One API and one worker.' },
  {
    value: 'architecture.microservices',
    label: 'Microservices (unimplemented)',
    hint: 'Experimental. Backend will reject approval.',
    disabled: true,
  },
];

const DEPLOYMENT_OPTIONS = [
  { value: 'deployment.local-hybrid', label: 'Local hybrid', hint: 'npm run dev with optional Compose Postgres/Redis.' },
  { value: 'deployment.docker-compose', label: 'Docker Compose', hint: 'Full Compose stack.' },
  {
    value: 'deployment.kubernetes',
    label: 'Kubernetes (unimplemented)',
    hint: 'Experimental. Backend will reject approval.',
    disabled: true,
  },
];

export function ProjectPlanningPage() {
  const { accessToken } = useAuth();
  const [step, setStep] = useState<StepId>('problem');
  const [title, setTitle] = useState('Hackathon project');
  const [statement, setStatement] = useState(EXAMPLE);
  const [catalog, setCatalog] = useState<CatalogCapability[]>([]);
  const [profiles, setProfiles] = useState<CatalogProfile[]>([]);
  const [recommendations, setRecommendations] = useState<CapabilityRecommendationResult>();
  const [configuration, setConfiguration] = useState<ProjectConfiguration>();
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [profile, setProfile] = useState('');
  const [architectureMode, setArchitectureMode] = useState('architecture.modular-monolith');
  const [deploymentMode, setDeploymentMode] = useState('deployment.local-hybrid');
  const [includeOptional, setIncludeOptional] = useState(false);
  const [closeDependencies, setCloseDependencies] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getCapabilities()
      .then((snapshot) => {
        setCatalog(snapshot.capabilities);
        setProfiles(snapshot.profiles);
      })
      .catch(() => {
        setError('Could not load the capability catalog.');
      });
  }, []);

  const selection: ProjectPlanningSelection = {
    title,
    statement,
    capabilities,
    profiles: profile ? [profile] : [],
    architectureMode,
    deploymentMode,
    includeOptional,
    closeDependencies,
  };

  const selectable = useMemo(
    () =>
      catalog.filter(
        (item) => item.kind === 'application' || item.kind === 'infrastructure' || item.kind === 'adapter',
      ),
    [catalog],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return selectable;
    }
    return selectable.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.summary.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle),
    );
  }, [query, selectable]);

  const recommendedNames = useMemo(() => {
    if (!recommendations) {
      return new Set<string>();
    }
    return new Set([
      ...recommendations.selected.capabilities,
      ...recommendations.selected.adapters,
      ...recommendations.selected.infrastructure,
    ]);
  }, [recommendations]);

  function applyConfiguration(next: ProjectConfiguration, recs?: CapabilityRecommendationResult) {
    setConfiguration(next);
    setCapabilities(next.resolved.capabilities);
    setProfile(next.resolved.profiles[0] ?? '');
    setArchitectureMode(next.resolved.architectureMode);
    setDeploymentMode(next.resolved.deploymentMode);
    if (recs) {
      setRecommendations(recs);
    }
  }

  async function analyze() {
    if (!accessToken) {
      setError('Sign in to analyze a problem statement.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await analyzeProjectPlanning({ statement, title }, accessToken);
      applyConfiguration(result.configuration, result.recommendations);
      setStep('requirements');
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The planning analyze request failed'));
    } finally {
      setLoading(false);
    }
  }

  async function validate() {
    if (!accessToken) {
      setError('Sign in to validate a selection.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await validateProjectPlanning(selection, accessToken);
      setConfiguration(result);
      setStep('review');
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The planning validate request failed'));
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!accessToken) {
      setError('Sign in to approve a configuration.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await approveProjectPlanning(selection, accessToken);
      setConfiguration(result);
      sessionStorage.setItem(PROJECT_CONFIGURATION_STORAGE_KEY, JSON.stringify(result));
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The planning approve request failed'));
    } finally {
      setLoading(false);
    }
  }

  function onUpload(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name) && file.type && !file.type.startsWith('text/')) {
      setError('Upload a .txt or .md problem statement. PDF uploads are not parsed here.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      if (text.length > 50_000) {
        setError('The uploaded statement is longer than 50,000 characters.');
        return;
      }
      setStatement(text);
      setError(undefined);
    };
    reader.readAsText(file);
  }

  function toggleCapability(name: string, checked: boolean) {
    setCapabilities((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return [...next].sort();
    });
  }

  function applyProfile(name: string) {
    setProfile(name);
    const chosen = profiles.find((item) => item.name === name);
    if (!chosen) {
      return;
    }
    const names = [...chosen.capabilities, ...(includeOptional ? chosen.optionalCapabilities ?? [] : [])];
    setCapabilities([...new Set(names)].sort());
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Project planning' }]} />}
      title="Project planning"
      description="Enter a problem statement, review extracted requirements and recommended capabilities, then select a profile, architecture, and deployment mode. The backend validates the selection. Nothing is generated and FEATURE_* is not changed."
    >
      <SessionGate title="Sign in to plan a project" hint="Manager and admin roles have projects.plan after seed.">
        <ol className="mb-6 flex flex-wrap gap-2" aria-label="Planning steps">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <Button
                type="button"
                size="sm"
                variant={step === item.id ? 'primary' : 'outline'}
                onClick={() => setStep(item.id)}
              >
                {index + 1}. {item.label}
              </Button>
            </li>
          ))}
        </ol>

        {error ? (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        ) : null}

        {step === 'problem' ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void analyze();
            }}
          >
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={loading || !accessToken}
            />
            <div>
              <label className={labelClass} htmlFor="planning-statement">
                Problem statement
              </label>
              <textarea
                id="planning-statement"
                className={`${controlBase} mt-1 min-h-40`}
                value={statement}
                maxLength={50_000}
                disabled={loading || !accessToken}
                onChange={(event) => setStatement(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="planning-upload">
                Upload problem statement
              </label>
              <input
                id="planning-upload"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="mt-1 block text-sm"
                disabled={loading || !accessToken}
                onChange={(event) => onUpload(event.target.files?.[0])}
              />
              <p className="mt-1 text-xs text-foreground-muted">Plain text or Markdown. The file is read in the browser and sent as the statement.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading || !accessToken} loading={loading}>
                Analyze statement
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || !accessToken}
                onClick={() => setStep('selection')}
              >
                Skip to selection
              </Button>
            </div>
          </form>
        ) : null}

        {step === 'requirements' ? (
          <RequirementsStep configuration={configuration} onNext={() => setStep('recommendations')} />
        ) : null}

        {step === 'recommendations' ? (
          <RecommendationsStep
            recommendations={recommendations}
            configuration={configuration}
            onNext={() => setStep('selection')}
          />
        ) : null}

        {step === 'selection' ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile, architecture, and deployment</CardTitle>
              </CardHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Profile"
                  value={profile}
                  onChange={(event) => applyProfile(event.target.value)}
                  options={[
                    { value: '', label: 'None (select capabilities directly)' },
                    ...profiles.map((item) => ({
                      value: item.name,
                      label: `${item.title} (${item.maturity})`,
                    })),
                  ]}
                  hint="A profile is a shortcut. You can still deselect individual capabilities. The backend does not trust this choice alone."
                />
                <div className="space-y-3">
                  <Checkbox
                    label="Include optional profile extras"
                    checked={includeOptional}
                    onChange={(event) => setIncludeOptional(event.target.checked)}
                  />
                  <Checkbox
                    label="Include required dependencies"
                    hint="When checked, the backend closes missing required dependencies. Optional extras stay off."
                    checked={closeDependencies}
                    onChange={(event) => setCloseDependencies(event.target.checked)}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <RadioGroup
                  name="architecture-mode"
                  label="Architecture mode"
                  value={architectureMode}
                  options={ARCHITECTURE_OPTIONS}
                  onChange={setArchitectureMode}
                />
                <RadioGroup
                  name="deployment-mode"
                  label="Deployment mode"
                  value={deploymentMode}
                  options={DEPLOYMENT_OPTIONS}
                  onChange={setDeploymentMode}
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capabilities</CardTitle>
              </CardHeader>
              <Search value={query} onChange={setQuery} placeholder="Filter catalog capabilities" className="mb-3" />
              <ul className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                {filtered.map((item) => (
                  <li key={item.name} className="rounded-lg border border-edge p-3">
                    <Checkbox
                      label={item.name}
                      hint={`${item.kind} · ${item.summary}`}
                      checked={capabilities.includes(item.name)}
                      onChange={(event) => toggleCapability(item.name, event.target.checked)}
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {recommendedNames.has(item.name) ? <Badge tone="success">Recommended</Badge> : null}
                      {item.conflicts.length ? <Badge tone="warning">Conflicts: {item.conflicts.join(', ')}</Badge> : null}
                      {item.dependencies.length ? (
                        <span className="text-xs text-foreground-muted">Requires {item.dependencies.join(', ')}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Button type="button" disabled={loading || !accessToken} loading={loading} onClick={() => void validate()}>
              Validate selection
            </Button>
          </div>
        ) : null}

        {step === 'review' ? (
          <ReviewStep
            configuration={configuration}
            loading={loading}
            disabled={!accessToken}
            onApprove={() => void approve()}
          />
        ) : null}
      </SessionGate>
    </PageContainer>
  );
}

function RequirementsStep({
  configuration,
  onNext,
}: {
  configuration?: ProjectConfiguration;
  onNext: () => void;
}) {
  if (!configuration) {
    return (
      <EmptyStep message="Analyze a statement first, or skip to selection." />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Extracted requirements</CardTitle>
        </CardHeader>
        <p className="mb-3 text-sm text-foreground">{configuration.problemSummary || 'No summary yet.'}</p>
        {configuration.requirements.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No structured mappings yet. Problem intelligence was skipped or returned none. Continue to recommendations
            or select capabilities from the catalog.
          </p>
        ) : (
          <ul className="space-y-2">
            {configuration.requirements.map((item) => (
              <li key={item.id} className="rounded-lg border border-edge p-3 text-sm">
                <p className="font-medium">{item.requirement}</p>
                <p className="text-xs text-foreground-muted">
                  {item.classification ?? 'unclassified'}
                  {item.existingCapability ? ` · ${item.existingCapability}` : ''}
                  {item.newProblemLogic ? ` · new logic: ${item.newProblemLogic}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Button type="button" onClick={onNext}>
        Continue to recommendations
      </Button>
    </div>
  );
}

function RecommendationsStep({
  recommendations,
  configuration,
  onNext,
}: {
  recommendations?: CapabilityRecommendationResult;
  configuration?: ProjectConfiguration;
  onNext: () => void;
}) {
  if (!recommendations && !configuration) {
    return <EmptyStep message="Analyze a statement to load advisory recommendations." />;
  }

  const reasons = configuration?.reasons ?? [];
  const conflicts = configuration?.conflicts ?? [];
  const dependencies = configuration?.dependencies ?? [];

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        Recommendations are advisory. Human selection remains authoritative. The backend will re-validate whatever you
        approve.
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Why each capability was recommended</CardTitle>
        </CardHeader>
        <ul className="space-y-3">
          {reasons.map((item) => (
            <li key={item.capability} className="rounded-lg border border-edge p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.capability}</span>
                <Badge tone={item.source === 'recommendation' ? 'success' : 'info'}>{item.source}</Badge>
                <AiConfidenceBadge value={item.confidence} />
              </div>
              <p className="text-xs text-foreground-muted">Requirement: {item.requirementSatisfied}</p>
              <p>{item.reason}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Dependencies: {item.dependencyImpact.adds.join(', ') || 'none'} · optional{' '}
                {item.dependencyImpact.optional.join(', ') || 'none'}
              </p>
              <p className="text-xs text-foreground-muted">
                Alternative: {item.alternative.name} — {item.alternative.reason}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dependencies</CardTitle>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          {dependencies.map((item) => (
            <li key={item.capability}>
              <span className="font-medium">{item.capability}</span>
              <span className="text-foreground-muted">
                {' '}
                requires {item.requires.join(', ') || 'none'}
                {item.missing.length ? ` · missing ${item.missing.join(', ')}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Conflicts</CardTitle>
        </CardHeader>
        {conflicts.length === 0 ? (
          <p className="text-sm text-foreground-muted">No catalog conflicts on the current draft set.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {conflicts.map((item) => (
              <li key={`${item.capability}-${item.conflictsWith}`}>
                {item.capability} conflicts with {item.conflictsWith}
                {item.bothSelected ? ' (both selected)' : ' (not both selected)'}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {recommendations?.rejected.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Not recommended</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {recommendations.rejected.map((item) => (
              <li key={item.id}>
                {item.capabilitySelected}: {item.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Button type="button" onClick={onNext}>
        Continue to selection
      </Button>
    </div>
  );
}

function ReviewStep({
  configuration,
  loading,
  disabled,
  onApprove,
}: {
  configuration?: ProjectConfiguration;
  loading: boolean;
  disabled: boolean;
  onApprove: () => void;
}) {
  if (!configuration) {
    return <EmptyStep message="Validate a selection to review the architecture." />;
  }

  const errors = configuration.validation.issues.filter((issue) => issue.severity === 'error');

  return (
    <div className="space-y-4">
      {configuration.approved ? (
        <Alert variant="success">
          Configuration approved. Phase 11 can consume this object. Code was not generated and FEATURE_* was not
          changed.
        </Alert>
      ) : (
        <Alert variant={configuration.validation.valid ? 'info' : 'error'}>
          {configuration.validation.valid
            ? 'Backend validation passed. Review the resolved architecture, then approve.'
            : 'Backend validation failed. Fix the issues below. Frontend checkboxes are not authoritative.'}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Final architecture</CardTitle>
          <Badge tone={configuration.validation.valid ? 'success' : 'danger'}>
            {configuration.status}
          </Badge>
        </CardHeader>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-foreground-muted">Architecture</dt>
            <dd className="font-medium">{configuration.resolved.architectureMode}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Deployment</dt>
            <dd className="font-medium">{configuration.resolved.deploymentMode}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Profiles</dt>
            <dd>{configuration.resolved.profiles.join(', ') || 'none'}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Ordered capabilities</dt>
            <dd>{configuration.resolved.ordered.join(', ') || 'none'}</dd>
          </div>
        </dl>
        {configuration.featureFlags.length ? (
          <p className="mt-3 text-xs text-foreground-muted">
            Suggested flags (advisory): {configuration.featureFlags.map((flag) => flag.name).join(', ')}
          </p>
        ) : null}
      </Card>

      {errors.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation issues</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {configuration.validation.issues.map((issue) => (
              <li key={`${issue.code}-${issue.capability ?? issue.profile ?? issue.message}`}>
                <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>{issue.code}</Badge> {issue.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Project configuration</CardTitle>
        </CardHeader>
        <p className="mb-2 text-xs text-foreground-muted">
          Schema {configuration.schemaVersion} · id {configuration.id} · digest {configuration.integrity.digest.slice(0, 12)}…
          Phase 11 must re-validate this object.
        </p>
        <pre className="max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-xs">
          {JSON.stringify(
            {
              id: configuration.id,
              status: configuration.status,
              approved: configuration.approved,
              generatedNothing: configuration.generatedNothing,
              resolved: configuration.resolved,
              validation: { valid: configuration.validation.valid, issueCount: configuration.validation.issues.length },
            },
            null,
            2,
          )}
        </pre>
      </Card>

      <Button
        type="button"
        disabled={disabled || loading || configuration.approved || !configuration.validation.valid}
        loading={loading}
        onClick={onApprove}
      >
        Approve configuration
      </Button>
      {configuration.approved ? (
        <p className="text-sm text-foreground-muted">
          Next:{' '}
          <Link className="underline" to="/project-generator">
            generate an isolated overlay
          </Link>{' '}
          (FEATURE_PROJECT_GENERATOR). The kit source is not modified.
        </p>
      ) : null}
    </div>
  );
}

function EmptyStep({ message }: { message: string }) {
  return (
    <Alert variant="info" className="mb-4">
      {message}
    </Alert>
  );
}
