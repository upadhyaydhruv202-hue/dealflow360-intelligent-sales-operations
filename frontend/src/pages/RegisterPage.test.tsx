import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider } from '../ui';
import { RegisterPage } from './RegisterPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('RegisterPage', () => {
  it('requires confirmation, terms, and a matching password before calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('All fields are required.');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Casey Buyer' } });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Buyer Co' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'casey@buyer.example' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Password confirmation does not match.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a customer session and lands on the account page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          user: {
            id: 'user-9',
            email: 'casey@buyer.example',
            displayName: 'Casey Buyer',
            status: 'active',
            role: 'user',
            roles: ['user'],
            permissions: [],
          },
          tokens: {
            accessToken: 'access-9',
            refreshToken: 'refresh-9',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        }, 201),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/account" element={<p>Customer home</p>} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Casey Buyer' } });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Buyer Co' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'casey@buyer.example' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long-enough' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Customer home')).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
