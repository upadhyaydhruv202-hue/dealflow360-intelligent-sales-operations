import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../theme/ThemeProvider';
import { CommandPalette } from './CommandPalette';

afterEach(() => {
  cleanup();
});

describe('CommandPalette', () => {
  it('lists navigation commands and closes after a selection', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <CommandPalette open onClose={onClose} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Command search'), { target: { value: 'approvals' } });
    fireEvent.click(screen.getByRole('option', { name: /Open approvals/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
