import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { RadioGroup } from './Radio';
import { Select } from './Select';
import { Tooltip } from './Tooltip';
import { Badge } from './Badge';
import { Alert } from './Alert';

afterEach(() => {
  cleanup();
});

describe('form primitives', () => {
  it('renders button variants, loading, and click handlers', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('associates input labels and surfaces validation errors', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('renders select options and checkbox state', () => {
    render(
      <>
        <Select label="Status" options={[{ value: 'open', label: 'Open' }]} defaultValue="open" />
        <Checkbox label="Subscribe" defaultChecked />
      </>,
    );
    expect(screen.getByLabelText('Status')).toHaveValue('open');
    expect(screen.getByLabelText('Subscribe')).toBeChecked();
  });

  it('notifies radio group changes', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="size"
        label="Size"
        value="sm"
        onChange={onChange}
        options={[
          { value: 'sm', label: 'Small' },
          { value: 'lg', label: 'Large' },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Large'));
    expect(onChange).toHaveBeenCalledWith('lg');
  });

  it('shows a tooltip on focus and renders badges and alerts', () => {
    render(
      <>
        <Tooltip content="More detail">
          <button type="button">Hint</button>
        </Tooltip>
        <Badge tone="success">Ready</Badge>
        <Alert variant="error" title="Failed">
          Try again
        </Alert>
      </>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('More detail');
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
});
