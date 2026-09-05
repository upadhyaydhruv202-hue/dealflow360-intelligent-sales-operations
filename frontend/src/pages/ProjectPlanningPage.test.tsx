import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { ProjectPlanningPage } from './ProjectPlanningPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('ProjectPlanningPage', () => {
  it('analyzes a statement, shows recommendations, validates selection, and approves a configuration', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/capabilities')) {
        return jsonResponse({
          architecture: 'architecture.modular-monolith',
          platformVersion: '0.1.0',
          capabilities: [
            catalogItem('auth', 'application', ['database']),
            catalogItem('database', 'application', ['infrastructure.postgres']),
            catalogItem('infrastructure.postgres', 'infrastructure', []),
          ],
          profiles: [
            {
              name: 'profile.basic-web',
              title: 'Basic Web',
              summary: 'Auth and Postgres',
              maturity: 'stable',
              capabilities: ['auth', 'database', 'infrastructure.postgres'],
            },
          ],
        });
      }
      if (url.includes('/project-planning/analyze')) {
        return jsonResponse({
          analysis: {
            spec: { problemSummary: 'Staff log in and search records by name.' },
            mappings: [
              {
                requirement: 'Users search records by name',
                category: 'data',
                classification: 'existing_capability',
                existingCapability: { name: 'database' },
              },
            ],
          },
          recommendations: recommendationFixture(),
          configuration: configurationFixture({ approved: false, status: 'draft' }),
        });
      }
      if (url.includes('/project-planning/validate')) {
        return jsonResponse(configurationFixture({ approved: false, status: 'draft' }));
      }
      if (url.includes('/project-planning/approve')) {
        return jsonResponse(
          configurationFixture({
            approved: true,
            status: 'approved',
            approvedAt: '2026-09-04T00:00:00.000Z',
          }),
        );
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider initialSession={TEST_SESSION}>
          <ProjectPlanningPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/v1/capabilities'))).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Analyze statement' }));
    expect(await screen.findByText('Users search records by name')).toBeInTheDocument();
    expect(screen.getByText('Staff log in and search records by name.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to recommendations' }));
    expect(await screen.findByText(/PostgreSQL is the kit database/)).toBeInTheDocument();
    expect(screen.getAllByText('infrastructure.postgres').length).toBeGreaterThan(0);
    expect(screen.getByText(/Do not add Elasticsearch/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to selection' }));
    expect(await screen.findByLabelText('Profile')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Architecture mode' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Deployment mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Validate selection' }));
    expect(await screen.findByText('Final architecture')).toBeInTheDocument();
    expect(screen.getByText('architecture.modular-monolith')).toBeInTheDocument();
    expect(screen.getByText('deployment.local-hybrid')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve configuration' }));
    expect(await screen.findByText(/Configuration approved/)).toBeInTheDocument();
    expect(screen.getByText(/Code was not generated/)).toBeInTheDocument();

    const approveCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/project-planning/approve'));
    expect(String((approveCall?.[1] as RequestInit | undefined)?.body)).toContain('infrastructure.postgres');
    expect(sessionStorage.getItem('hsk.project-configuration')).toContain('"approved":true');
  });
});

function catalogItem(name: string, kind: string, dependencies: string[]) {
  return {
    name,
    kind,
    category: kind === 'infrastructure' ? 'infrastructure' : 'core',
    maturity: 'stable',
    summary: `${name} capability`,
    dependencies,
    optionalDependencies: [],
    conflicts: [],
  };
}

function configurationFixture(overrides: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    id: 'cfg-1',
    status: 'draft',
    approved: false,
    generatedNothing: true,
    humanSelectionAuthoritative: true,
    catalogVersion: '0.1.0',
    platformVersion: '0.1.0',
    title: 'Hackathon project',
    problemSummary: 'Staff log in and search records by name.',
    requirements: [
      {
        id: 'req-1',
        requirement: 'Users search records by name',
        category: 'data',
        classification: 'existing_capability',
        existingCapability: 'database',
        newProblemLogic: null,
        source: 'analysis',
      },
    ],
    proposed: {
      capabilities: ['auth', 'database', 'infrastructure.postgres'],
      profiles: ['profile.basic-web'],
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
      includeOptional: false,
      closeDependencies: false,
    },
    resolved: {
      capabilities: ['auth', 'database', 'infrastructure.postgres'],
      ordered: ['infrastructure.postgres', 'database', 'auth'],
      profiles: ['profile.basic-web'],
      adapters: [],
      infrastructure: ['infrastructure.postgres'],
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
      required: ['auth', 'database', 'infrastructure.postgres'],
      missing: [],
      optionalMissing: [],
    },
    reasons: [
      {
        capability: 'infrastructure.postgres',
        requirementSatisfied: 'Search / persist application records',
        reason: 'PostgreSQL is the kit database.',
        source: 'recommendation',
        confidence: 0.9,
        alternative: { name: 'omit', reason: 'Leave off if unused.' },
        dependencyImpact: { adds: [], optional: [], missingIfSelected: [] },
      },
    ],
    dependencies: [
      { capability: 'auth', requires: ['database'], optional: [], missing: [] },
      { capability: 'database', requires: ['infrastructure.postgres'], optional: [], missing: [] },
      { capability: 'infrastructure.postgres', requires: [], optional: [], missing: [] },
    ],
    conflicts: [],
    validation: {
      valid: true,
      permissionsOk: true,
      capabilityExistence: { unknown: [] },
      missingDependencies: [],
      conflicts: [],
      compatibility: {
        architectureMode: 'architecture.modular-monolith',
        deploymentMode: 'deployment.local-hybrid',
        issues: [],
      },
      featureAvailability: [],
      unimplementedModes: [],
      issues: [],
    },
    featureFlags: [],
    notes: ['Phase 10 produces a validated Project Configuration only.'],
    generation: {
      allowed: false,
      attempted: false,
      note: 'Phase 10 produces a validated Project Configuration only.',
    },
    integrity: { algorithm: 'sha256', digest: 'abc123def456' },
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

function recommendationFixture() {
  return {
    advisory: true,
    humanSelectionAuthoritative: true,
    enabledNothing: true,
    architectureMode: recItem('architecture.modular-monolith', 'architecture-mode'),
    deploymentMode: recItem('deployment.local-hybrid', 'deployment-mode'),
    profiles: [recItem('profile.basic-web', 'profile')],
    capabilities: [recItem('database', 'capability')],
    adapters: [],
    infrastructure: [recItem('infrastructure.postgres', 'infrastructure')],
    rejected: [
      {
        ...recItem('elasticsearch', 'infrastructure'),
        status: 'not_recommended',
        reason: 'Do not add Elasticsearch.',
      },
    ],
    selected: {
      capabilities: ['database', 'auth'],
      profiles: ['profile.basic-web'],
      adapters: [],
      infrastructure: ['infrastructure.postgres'],
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
    },
    featureFlags: [],
    resolution: {
      valid: true,
      selected: ['auth', 'database', 'infrastructure.postgres'],
      ordered: ['infrastructure.postgres', 'database', 'auth'],
      required: [],
      missing: [],
      optionalMissing: [],
      issueCount: 0,
    },
    notes: [],
    unknowns: [],
    confidence: 0.9,
    catalogVersion: '0.1.0',
  };
}

function recItem(name: string, kind: string) {
  return {
    id: `${kind}:${name}`,
    kind,
    status: 'recommended',
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
