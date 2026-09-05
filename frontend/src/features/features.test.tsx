import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { FeatureGate, FeatureProvider, isDemoMode, isFeatureEnabled } from './index';
import { ThemeProvider } from '../ui';
import { AppLayout } from '../layouts/AppLayout';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('feature flag helpers', () => {
  it('treats enabled, disabled, and missing flags correctly', () => {
    const state = { demoMode: true, features: { ai: true, sms: false } };
    expect(isFeatureEnabled(state, 'ai')).toBe(true);
    expect(isFeatureEnabled(state, 'sms')).toBe(false);
    expect(isFeatureEnabled(state, 'copilot')).toBe(false);
    expect(isDemoMode(state)).toBe(true);
    expect(isDemoMode({ demoMode: false, features: {} })).toBe(false);
  });
});

describe('FeatureProvider', () => {
  it('loads server flags and hides disabled navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/features')) {
          return jsonResponse({
            demoMode: true,
            features: { copilot: true, automation: false, notifications: true },
          });
        }
        return jsonResponse({});
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <AppLayout />
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quotations' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Copilot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Automations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Products / Policies' })).toBeInTheDocument();
  });

  it('shows the Realtime nav when FEATURE_REALTIME is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/features')) {
          return jsonResponse({
            demoMode: true,
            features: { realtime: true },
          });
        }
        return jsonResponse({});
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <AppLayout />
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Fulfillment' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Realtime' })).not.toBeInTheDocument();
  });

  it('shows the Search nav when FEATURE_SEARCH is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/features')) {
          return jsonResponse({
            demoMode: true,
            features: { search: true },
          });
        }
        return jsonResponse({});
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <AppLayout />
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Invoices' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('shows the Analytics nav when FEATURE_ANALYTICS is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/features')) {
          return jsonResponse({
            demoMode: true,
            features: { analytics: true },
          });
        }
        return jsonResponse({});
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <AppLayout />
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
  });
});

describe('FeatureGate', () => {
  it('shows an empty state when the flag is off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          demoMode: false,
          features: { copilot: false },
        }),
      ),
    );

    render(
      <FeatureProvider>
        <FeatureGate feature="copilot">
          <p>Chat</p>
        </FeatureGate>
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('This capability is turned off')).toBeInTheDocument();
    });
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
