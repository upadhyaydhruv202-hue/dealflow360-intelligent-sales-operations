import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { PROJECT_CONFIGURATION_STORAGE_KEY } from '../services/project-planning';
import { TEST_SESSION } from '../test/session';
import { ProjectGeneratorPage } from './ProjectGeneratorPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('ProjectGeneratorPage', () => {
  it('previews and generates from a saved approved configuration', async () => {
    sessionStorage.setItem(
      PROJECT_CONFIGURATION_STORAGE_KEY,
      JSON.stringify({
        approved: true,
        status: 'approved',
        title: 'Auth Search',
        resolved: {
          architectureMode: 'architecture.modular-monolith',
          deploymentMode: 'deployment.local-hybrid',
        },
        integrity: { digest: 'a'.repeat(64) },
      }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = {
        outputRoot: '/tmp/generated/projects/auth-search',
        relativeRoot: 'generated/projects/auth-search',
        dryRun: url.includes('/preview'),
        files: [{ path: 'project.manifest.json', role: 'manifest', sha256: 'ab', bytes: 12, status: 'preview' }],
        contentDigest: 'c'.repeat(64),
        configurationDigest: 'd'.repeat(64),
        generationManifest: {
          platformVersion: '0.1.0',
          generatedAt: '2026-09-04T12:00:00.000Z',
          problemModule: 'auth-search',
          architectureMode: 'architecture.modular-monolith',
          deploymentMode: 'deployment.local-hybrid',
          contentDigest: 'c'.repeat(64),
          fileCount: 1,
        },
      };
      return jsonResponse(body);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider initialSession={TEST_SESSION}>
          <ProjectGeneratorPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => {
      expect(screen.getByText(/content digest/i)).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/project-generator/preview'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Generate overlay' }));
    await waitFor(() => {
      expect(screen.getByText('Generated overlay')).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/project-generator/generate'))).toBe(true);
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
