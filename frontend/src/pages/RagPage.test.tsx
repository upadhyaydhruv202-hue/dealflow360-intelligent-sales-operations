import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { RagPage } from './RagPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('RagPage', () => {
  it('indexes a document and asks a grounded question', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/rag/index')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ async: false });
        return jsonResponse({ documentId: 'refund-policy', chunkCount: 1, status: 'indexed' });
      }
      if (url.endsWith('/api/v1/rag/ask')) {
        expect(init?.method).toBe('POST');
        return jsonResponse({
          answer: 'The refund window is 14 days after delivery.',
          grounded: true,
          confidence: 0.86,
          sources: [
            {
              documentId: 'refund-policy',
              chunkId: 'refund-policy:0000',
              source: 'Refund policy',
              quote: 'Customers may request a refund within 14 days.',
              score: 0.81,
            },
          ],
          unsupported: [],
          injectionSignals: [],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider initialSession={TEST_SESSION}>
          <RagPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Index document' }));
    expect(await screen.findByText(/Indexed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask with sources' }));
    expect(
      await screen.findByText('The refund window is 14 days after delivery.'),
    ).toBeInTheDocument();
    expect(screen.getByText('grounded')).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
