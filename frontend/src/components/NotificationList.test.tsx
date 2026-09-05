import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationList } from './NotificationList';
import { NotificationBell } from './NotificationBell';
import { NotificationPreferences } from './NotificationPreferences';

describe('NotificationList', () => {
  it('renders an empty state', () => {
    render(<NotificationList items={[]} />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('renders notification titles and marks one read', () => {
    const reads: string[] = [];
    render(
      <NotificationList
        items={[
          {
            id: '1',
            type: 'info',
            title: 'Welcome',
            body: 'Your demo account is ready',
          },
        ]}
        onRead={(id) => reads.push(id)}
      />,
    );
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Your demo account is ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(reads).toEqual(['1']);
  });
});

describe('NotificationBell', () => {
  it('opens the inbox and shows unread count', () => {
    render(
      <NotificationBell
        unreadCount={2}
        items={[{ id: '1', type: 'info', title: 'Hello', body: 'There' }]}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

describe('NotificationPreferences', () => {
  it('locks security alerts and reports a marketing change', () => {
    const changes: unknown[] = [];
    render(
      <NotificationPreferences
        preferences={[{ category: 'marketing', channel: 'email', enabled: true }]}
        onChange={(preference) => changes.push(preference)}
      />,
    );
    const security = screen.getByLabelText('security_alerts email');
    expect(security).toBeDisabled();
    fireEvent.click(screen.getByLabelText('marketing email'));
    expect(changes).toEqual([{ category: 'marketing', channel: 'email', enabled: false }]);
  });
});
