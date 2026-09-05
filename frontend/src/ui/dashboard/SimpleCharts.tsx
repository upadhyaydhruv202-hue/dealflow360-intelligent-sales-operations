import { EmptyState } from '../states/FeedbackStates';

export interface ChartDatum {
  label: string;
  value: number;
}

const CHART_WIDTH = 520;
const CHART_HEIGHT = 220;
const PAD = { top: 16, right: 12, bottom: 32, left: 36 };

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

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const width = 88;
  const height = 28;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? 'h-7 w-24 text-accent'} aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}

export function SimpleBarChart({ data, unit, title = 'Bar chart' }: { data: ChartDatum[]; unit?: string; title?: string }) {
  const series = normalize(data);
  if (series.length === 0) {
    return <EmptyState title="No chart data" className="border-0 px-0 py-6" />;
  }

  const { max, innerWidth, innerHeight } = bounds(series);
  const barWidth = innerWidth / series.length;
  const gap = Math.min(14, barWidth * 0.32);

  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-52 w-full text-accent">
      <title>{title}</title>
      {[0.25, 0.5, 0.75, 1].map((tick) => {
        const y = PAD.top + innerHeight * (1 - tick);
        return <line key={tick} x1={PAD.left} x2={CHART_WIDTH - PAD.right} y1={y} y2={y} className="stroke-edge" />;
      })}
      {series.map((item, index) => {
        const height = (item.value / max) * innerHeight;
        const x = PAD.left + index * barWidth + gap / 2;
        const y = PAD.top + innerHeight - height;
        const width = Math.max(6, barWidth - gap);
        return (
          <g key={`${item.label}-${index}`}>
            <title>
              {item.label}: {item.value}
              {unit ? ` ${unit}` : ''}
            </title>
            <rect x={x} y={y} width={width} height={height} rx={3} className="fill-current opacity-90" />
            <text x={x + width / 2} y={y - 4} textAnchor="middle" className="fill-foreground text-[10px]">
              {item.value}
              {unit ? ` ${unit}` : ''}
            </text>
            <text x={x + width / 2} y={CHART_HEIGHT - 10} textAnchor="middle" className="fill-foreground-muted text-[10px]">
              {item.label}
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
    const x = PAD.left + (series.length === 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth);
    const y = PAD.top + innerHeight - (item.value / max) * innerHeight;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${PAD.left},${PAD.top + innerHeight} ${polyline} ${points[points.length - 1].x},${PAD.top + innerHeight}`;

  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-52 w-full text-accent">
      <title>{title}</title>
      <polyline points={area} className="fill-current opacity-10" stroke="none" />
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
          <title>
            {point.label}: {point.value}
            {unit ? ` ${unit}` : ''}
          </title>
          <circle cx={point.x} cy={point.y} r="3" className="fill-current" />
          <text x={point.x} y={point.y - 8} textAnchor="middle" className="fill-foreground text-[10px]">
            {point.value}
            {unit ? ` ${unit}` : ''}
          </text>
          <text x={point.x} y={CHART_HEIGHT - 10} textAnchor="middle" className="fill-foreground-muted text-[10px]">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
