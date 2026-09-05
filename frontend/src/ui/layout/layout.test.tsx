import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActivityFeed, NotificationPanel, TableSection } from '../dashboard/Panels';
import { DashboardLayout } from '../dashboard/DashboardLayout';
import { KpiCard } from '../dashboard/KpiCard';
import { SimpleBarChart } from '../dashboard/SimpleCharts';
import { AppShell } from '../layout/AppShell';
import { Breadcrumb } from '../layout/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../states/FeedbackStates';
import { ThemeProvider, THEME_STORAGE_KEY } from '../theme/ThemeProvider';
import { ToastProvider, useToast } from '../toast/ToastProvider';
import { AiConfidenceBadge, AiLoadingState, AiResponseCard, ToolActivityIndicator } from '../ai/AiPrimitives';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

function renderShell(ui: ReactElement) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('feedback and layout', () => {
  it('renders empty, error, and loading states', () => {
    const onRetry = vi.fn();
    render(
      <>
        <EmptyState title="Nothing yet" />
        <ErrorState message="Network down" onRetry={onRetry} />
        <LoadingState />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('toggles theme from the app shell', () => {
    renderShell(
      <AppShell brand="Kit" navigation={<a href="/">Home</a>}>
        <p>Main</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('renders breadcrumbs and dashboard slots without domain data', () => {
    renderShell(
      <>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]} />
        <DashboardLayout
          kpis={<KpiCard label="Primary metric" value="10" />}
          charts={<SimpleBarChart data={[{ label: 'Bucket A', value: 3 }]} />}
          activity={<ActivityFeed items={[]} />}
          notifications={<NotificationPanel items={[]} />}
          table={<TableSection title="Records">Table body</TableSection>}
        />
      </>,
    );
    expect(screen.getByText('Primary metric')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();
  });
});

describe('toasts and AI UI', () => {
  it('publishes a toast through context', () => {
    function Probe() {
      const { toast } = useToast();
      return (
        <button type="button" onClick={() => toast({ title: 'Saved', variant: 'success' })}>
          Notify
        </button>
      );
    }
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('renders confidence, tools, and AI loading copy', () => {
    render(
      <>
        <AiConfidenceBadge value={0.8} />
        <AiLoadingState />
        <ToolActivityIndicator tools={[{ name: 'lookup', status: 'success', riskLevel: 'low' }]} />
        <AiResponseCard content="Validated output" evidence="Source document" />
      </>,
    );
    expect(screen.getByText('Confidence 80%')).toBeInTheDocument();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    expect(screen.getByText('lookup')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
  });
});
