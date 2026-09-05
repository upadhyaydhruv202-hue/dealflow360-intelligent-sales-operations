import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SimpleBarChart, SimpleLineChart } from './SimpleCharts';

afterEach(() => {
  cleanup();
});

describe('SimpleCharts', () => {
  it('renders bar and line labels', () => {
    render(
      <>
        <SimpleBarChart title="Volume" data={[{ label: 'A', value: 10 }, { label: 'B', value: 4 }]} />
        <SimpleLineChart title="Trend" data={[{ label: 'Mon', value: 2 }, { label: 'Tue', value: 8 }]} />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Trend' })).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });

  it('renders an empty state', () => {
    render(<SimpleBarChart data={[]} />);
    expect(screen.getByText('No chart data')).toBeInTheDocument();
  });

  it('clamps non-finite and negative values and keeps duplicate labels', () => {
    render(
      <SimpleBarChart
        title="Clamped"
        data={[
          { label: 'A', value: Number.NaN },
          { label: 'A', value: -8 },
          { label: 'B', value: Number.POSITIVE_INFINITY },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Clamped' })).toBeInTheDocument();
    expect(screen.getAllByText('A')).toHaveLength(2);
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
