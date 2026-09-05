import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopilotChat } from './CopilotChat';

afterEach(() => {
  cleanup();
});

describe('CopilotChat', () => {
  it('renders messages, tool status, and confidence', () => {
    render(
      <CopilotChat
        messages={[
          { id: '1', role: 'user', content: 'Find the customer' },
          {
            id: '2',
            role: 'assistant',
            content: 'I looked that up.',
            confidence: 0.8,
            evidence: 'Tool result for getCustomer',
            tools: [{ name: 'getCustomer', status: 'success', riskLevel: 'low' }],
          },
        ]}
        onSend={() => undefined}
      />,
    );

    expect(screen.getByText('Find the customer')).toBeInTheDocument();
    expect(screen.getByText('I looked that up.')).toBeInTheDocument();
    expect(screen.getByText('getCustomer')).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence 80%/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence/)).toBeInTheDocument();
  });

  it('sends a message, retries, clears, and confirms', () => {
    const onSend = vi.fn();
    const onRetry = vi.fn();
    const onClear = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CopilotChat
        messages={[{ id: '1', role: 'assistant', content: 'Confirm delete?', tools: [{ name: 'deleteRecord', status: 'pending_confirmation', riskLevel: 'high' }] }]}
        pendingConfirmation
        onSend={onSend}
        onRetry={onRetry}
        onClear={onClear}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText('Message') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Hello');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows a loading state', () => {
    render(<CopilotChat messages={[]} loading onSend={() => undefined} />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });
});
