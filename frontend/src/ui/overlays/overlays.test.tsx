import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';
import { Dropdown } from './Dropdown';
import { Modal } from './Modal';
import { Tabs } from './Tabs';
import { Button } from '../primitives/Button';

afterEach(() => {
  cleanup();
});

describe('overlays', () => {
  it('opens a modal, traps escape, and closes', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        Body copy
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
    onClose.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a drawer and closes from the overlay', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Filters">
        Drawer body
      </Drawer>,
    );
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('selects dropdown items with keyboard support on the trigger', () => {
    const onSelect = vi.fn();
    const onTriggerClick = vi.fn();
    render(
      <Dropdown
        trigger={<Button onClick={onTriggerClick}>Menu</Button>}
        items={[
          { id: 'edit', label: 'Edit', onSelect },
          { id: 'delete', label: 'Delete', destructive: true },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onTriggerClick).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves between tabs with arrow keys', () => {
    render(
      <Tabs
        items={[
          { id: 'one', label: 'One', content: 'First panel' },
          { id: 'two', label: 'Two', content: 'Second panel' },
        ]}
      />,
    );
    expect(screen.getByText('First panel')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByText('Second panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
  });
});
