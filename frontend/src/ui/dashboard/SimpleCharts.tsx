import { EmptyState } from '../states/FeedbackStates';

export interface ChartDatum {
  label: string;
  value: number;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 36, left: 36 };

function bounds(data: ChartDatum[]) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const innerWidth = CHART_WIDTH - PAD.left - PAD.right;
  const innerHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  return { max, innerWidth, innerHeight };
}

function normalize(data: ChartDatum[]): ChartDatum[] {
  return data.map((item, index) => ({
    label: item.label || `Item ${index + 1}`,
    value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0,
  }));
}

export function SimpleBarChart({ data, unit, title = 'Bar chart' }: { data: ChartDatum[]; unit?: string; title?: string }) {
  const series = normalize(data);
  if (series.length === 0) {
    return <EmptyState title="No chart data" className="border-0 px-0 py-6" />;
  }

  const { max, innerWidth, innerHeight } = bounds(series);
  const barWidth = innerWidth / series.length;
  const gap = Math.min(12, barWidth * 0.25);

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="h-44 w-full text-accent"
    >
      <title>{title}</title>
      {series.map((item, index) => {
        const height = (item.value / max) * innerHeight;
        const x = PAD.left + index * barWidth + gap / 2;
        const y = PAD.top + innerHeight - height;
        const width = Math.max(4, barWidth - gap);
        return (
          <g key={`${item.label}-${index}`}>
            <rect x={x} y={y} width={width} height={height} rx={4} className="fill-current" />
            <text
              x={x + width / 2}
              y={CHART_HEIGHT - 12}
              textAnchor="middle"
              className="fill-foreground-muted text-[10px]"
            >
              {item.label}
            </text>
            <text
              x={x + width / 2}
              y={y - 4}
              textAnchor="middle"
              className="fill-foreground text-[10px]"
            >
              {item.value}
              {unit ? ` ${unit}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SimpleLineChart({ data, unit, title = 'Line chart' }: { data: ChartDatum[]; unit?: string; title?: string }) {
  const series = normalize(data);
  if (series.length === 0) {
    return <EmptyState title="No chart data" className="border-0 px-0 py-6" />;
  }

  const { max, innerWidth, innerHeight } = bounds(series);
  const points = series.map((item, index) => {
    const x =
      PAD.left + (series.length === 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth);
    const y = PAD.top + innerHeight - (item.value / max) * innerHeight;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="h-44 w-full text-accent"
    >
      <title>{title}</title>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="3.5" className="fill-current" />
          <text x={point.x} y={CHART_HEIGHT - 12} textAnchor="middle" className="fill-foreground-muted text-[10px]">
            {point.label}
          </text>
          <text x={point.x} y={point.y - 8} textAnchor="middle" className="fill-foreground text-[10px]">
            {point.value}
            {unit ? ` ${unit}` : ''}
          </text>
        </g>
      ))}
    </svg>
  );
}
