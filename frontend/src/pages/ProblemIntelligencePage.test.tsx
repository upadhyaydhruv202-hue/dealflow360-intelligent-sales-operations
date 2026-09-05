import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { ProblemIntelligencePage } from './ProblemIntelligencePage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('ProblemIntelligencePage', () => {
  it('analyzes a problem statement and shows classified requirements', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        title: 'Work items',
        spec: {
          problemSummary: 'Staff log in and record a work item.',
          users: { determined: true, items: [{ name: 'Staff', description: 'Creates the core record.' }] },
          actors: { determined: true, items: [{ name: 'Staff user', kind: 'human', description: 'Authenticated user.' }] },
          workflows: { determined: true, items: [] },
          entities: { determined: true, items: [{ name: 'Work item', fields: ['title'], description: 'Core record.' }] },
          businessRules: { determined: false, items: [] },
          integrations: { determined: false, items: [] },
          odooRequirements: { determined: false, items: [] },
          aiRequirements: { determined: false, items: [] },
          automationRequirements: { determined: false, items: [] },
          notifications: { determined: false, items: [] },
          documents: { determined: false, items: [] },
          reports: { determined: false, items: [] },
          securityRequirements: { determined: true, items: [{ name: 'Login', description: 'Use platform auth.' }] },
          nonFunctionalRequirements: { determined: false, items: [] },
          likelyDataRequirements: { determined: true, items: [{ name: 'work_items table', description: 'PostgreSQL.' }] },
          likelyInfrastructureRequirements: { determined: false, items: [] },
        },
        mappings: [
          {
            requirement: 'Users must log in',
            category: 'security',
            classification: 'existing_capability',
            existingCapability: { name: 'auth', summary: 'JWT auth', maturity: 'stable' },
            newProblemLogic: null,
            hallucinatedCapability: null,
            confidence: 0.93,
          },
        ],
        existingCapabilities: [{ name: 'auth', summary: 'JWT auth', requirements: ['Users must log in'] }],
        newProblemLogic: [],
        unknowns: ['Odoo models'],
        uncertainty: [],
        confidence: 0.78,
        requiresReview: true,
        injection: { suspicious: false, signals: [] },
        catalogVersion: '0.1.0',
        promptVersion: 'v1',
        model: 'mock',
        provider: 'mock',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <AuthProvider initialSession={TEST_SESSION}>
          <ProblemIntelligencePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Analyze statement' }));
    expect(await screen.findByText('Staff log in and record a work item.')).toBeInTheDocument();
    expect(screen.getByText('Users must log in')).toBeInTheDocument();
    expect(screen.getByText(/Staff — Creates the core record/)).toBeInTheDocument();
    expect(screen.getByText('Odoo requirements')).toBeInTheDocument();
    expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/existing capability/i).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalled();
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(String(requestInit?.body)).toContain('Staff in a warehouse');
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
