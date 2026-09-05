import type { ReactElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, ToastProvider } from '../ui';
import { DashboardPage } from './DashboardPage';
import { UiKitPage } from './UiKitPage';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPage(ui: ReactElement) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('gallery pages', () => {
  it('renders the dashboard slots and charts', () => {
    renderPage(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Trend' })).toBeInTheDocument();
    expect(screen.getByText('Sample record A')).toBeInTheDocument();
  });

  it('renders the UI kit gallery', () => {
    renderPage(<UiKitPage />);
    expect(screen.getByRole('heading', { name: 'UI kit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open modal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
