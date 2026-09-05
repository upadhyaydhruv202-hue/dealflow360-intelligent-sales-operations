import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import { generateProjectOverlay, previewProjectGeneration } from '../services/project-generator';
import {
  PROJECT_CONFIGURATION_STORAGE_KEY,
  type ProjectConfiguration,
} from '../services/project-planning';
import { Alert, Badge, Breadcrumb, Button, Card, CardHeader, CardTitle, PageContainer } from '../ui';

export function ProjectGeneratorPage() {
  const { accessToken } = useAuth();
  const [configuration, setConfiguration] = useState<ProjectConfiguration>();
  const [fileCount, setFileCount] = useState<number>();
  const [digest, setDigest] = useState<string>();
  const [relativeRoot, setRelativeRoot] = useState<string>();
  const [wrote, setWrote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const raw = sessionStorage.getItem(PROJECT_CONFIGURATION_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setConfiguration(JSON.parse(raw) as ProjectConfiguration);
    } catch {
      setError('Saved project configuration is not valid JSON.');
    }
  }, []);

  async function onPreview() {
    if (!accessToken || !configuration) {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await previewProjectGeneration(configuration, accessToken);
      setFileCount(result.files.length);
      setDigest(result.contentDigest);
      setRelativeRoot(result.relativeRoot);
      setWrote(false);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Preview failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onGenerate() {
    if (!accessToken || !configuration) {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await generateProjectOverlay(configuration, accessToken);
      setFileCount(result.files.length);
      setDigest(result.contentDigest);
      setRelativeRoot(result.relativeRoot);
      setWrote(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Generation failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SessionGate>
      <PageContainer
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Home', to: '/' },
              { label: 'Project planning', to: '/project-planning' },
              { label: 'Generator' },
            ]}
          />
        }
        title="Project generator"
        description="Consumes an approved Project Configuration and writes an isolated overlay under generated/. The starter kit is not modified."
      >
        {error ? (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        ) : null}

        {!configuration ? (
          <Alert variant="info">
            Approve a configuration in{' '}
            <Link className="underline" to="/project-planning">
              Project planning
            </Link>{' '}
            first. This page does not enable FEATURE_* or install packages.
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Approved configuration</CardTitle>
                {configuration.approved ? <Badge tone="success">approved</Badge> : <Badge tone="warning">not approved</Badge>}
              </CardHeader>
              <p className="text-sm text-foreground-muted">
                {configuration.title ?? 'Untitled'} · {configuration.resolved.architectureMode} ·{' '}
                {configuration.resolved.deploymentMode} · digest {configuration.integrity.digest.slice(0, 12)}…
              </p>
              <p className="mt-2 text-xs text-foreground-muted">
                The backend re-validates this object. AI recommendations are not an install or shell channel.
              </p>
            </Card>

            {digest ? (
              <Card>
                <CardHeader>
                  <CardTitle>{wrote ? 'Generated overlay' : 'Preview'}</CardTitle>
                </CardHeader>
                <p className="text-sm">
                  {fileCount} files · content digest <code>{digest.slice(0, 16)}…</code>
                </p>
                {relativeRoot ? <p className="mt-1 text-xs text-foreground-muted">{relativeRoot}</p> : null}
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading || !configuration.approved} loading={loading} onClick={() => void onPreview()}>
                Preview
              </Button>
              <Button
                type="button"
                disabled={loading || !configuration.approved}
                loading={loading}
                onClick={() => void onGenerate()}
              >
                Generate overlay
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
    </SessionGate>
  );
}
