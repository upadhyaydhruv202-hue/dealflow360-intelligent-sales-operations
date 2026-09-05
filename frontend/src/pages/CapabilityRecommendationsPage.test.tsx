import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { CapabilityRecommendationsPage } from './CapabilityRecommendationsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('CapabilityRecommendationsPage', () => {
  it('recommends PostgreSQL for a simple-search analysis and shows the advisory banner', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        advisory: true,
        humanSelectionAuthoritative: true,
        enabledNothing: true,
        architectureMode: item('architecture.modular-monolith', 'architecture-mode', 'baseline'),
        deploymentMode: item('deployment.local-hybrid', 'deployment-mode', 'baseline'),
        profiles: [item('profile.basic-web', 'profile', 'baseline')],
        capabilities: [item('database', 'capability', 'recommended')],
        adapters: [],
        infrastructure: [item('infrastructure.postgres', 'infrastructure', 'recommended')],
        rejected: [item('elasticsearch', 'infrastructure', 'not_recommended')],
        selected: {
          capabilities: ['database'],
          profiles: ['profile.basic-web'],
          adapters: [],
          infrastructure: ['infrastructure.postgres'],
          architectureMode: 'architecture.modular-monolith',
          deploymentMode: 'deployment.local-hybrid',
        },
        featureFlags: [],
        resolution: {
          valid: true,
          selected: ['database', 'infrastructure.postgres'],
          ordered: ['infrastructure.postgres', 'database'],
          required: ['database', 'infrastructure.postgres'],
          missing: [],
          optionalMissing: [],
          issueCount: 0,
        },
        notes: ['Recommendations are advisory. Human selection remains authoritative.'],
        unknowns: [],
        confidence: 0.9,
        catalogVersion: '0.1.0',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <CapabilityRecommendationsPage />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recommend capabilities' }));
    expect(await screen.findByText(/Nothing was enabled and FEATURE_\*/)).toBeInTheDocument();
    expect(screen.getByText('infrastructure.postgres')).toBeInTheDocument();
    expect(screen.getByText('elasticsearch')).toBeInTheDocument();
    expect(screen.getByText('database')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(String(requestInit?.body)).toContain('customer records by name');
  });
});

function item(
  name: string,
  kind: string,
  status: string,
): Record<string, unknown> {
  return {
    id: `${kind}:${name}`,
    kind,
    status,
    requirementSatisfied: 'Search / persist application records',
    capabilitySelected: name,
    reason: name === 'elasticsearch' ? 'Do not add Elasticsearch.' : 'PostgreSQL is the kit database.',
    dependencyImpact: { adds: [], optional: [], missingIfSelected: [] },
    complexityImpact: 'low',
    securityImpact: 'low',
    confidence: 0.9,
    alternative: { name: 'omit', reason: 'Leave off if unused.' },
    advisory: true,
  };
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
