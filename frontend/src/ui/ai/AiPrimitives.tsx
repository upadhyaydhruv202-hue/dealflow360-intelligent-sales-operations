import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn';
import { Badge, type BadgeTone } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';

export function AiActionButton({
  children = 'Ask AI',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <Button variant="secondary" {...props}>
      {children}
    </Button>
  );
}

export function AiConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone: BadgeTone = percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger';
  return <Badge tone={tone}>Confidence {percent}%</Badge>;
}

export function EvidencePanel({
  title = 'Evidence',
  items,
  children,
}: {
  title?: string;
  items?: string[];
  children?: ReactNode;
}) {
  if ((!items || items.length === 0) && !children) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-edge bg-surface-muted/60 px-3 py-2 text-xs text-foreground-muted">
      <p className="font-semibold text-foreground">{title}</p>
      {items && items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

export function AiLoadingState({ label = 'Thinking…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground-muted" role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export type ToolActivityStatus =
  | 'success'
  | 'failed'
  | 'denied'
  | 'invalid_arguments'
  | 'pending_confirmation'
  | 'running';

export interface ToolActivity {
  name: string;
  status: ToolActivityStatus;
  riskLevel?: 'low' | 'medium' | 'high';
  error?: string;
}

const statusTone: Record<ToolActivityStatus, BadgeTone> = {
  success: 'success',
  failed: 'danger',
  denied: 'danger',
  invalid_arguments: 'warning',
  pending_confirmation: 'warning',
  running: 'info',
};

export function ToolActivityIndicator({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1">
      {tools.map((tool) => (
        <li key={`${tool.name}-${tool.status}`} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{tool.name}</span>
          <Badge tone={statusTone[tool.status]}>{tool.status.replace('_', ' ')}</Badge>
          {tool.riskLevel ? <span className="opacity-70">{tool.riskLevel} risk</span> : null}
          {tool.error ? <span>{tool.error}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function AiResponseCard({
  content,
  confidence,
  evidence,
  error,
  tools,
  className,
}: {
  content: ReactNode;
  confidence?: number;
  evidence?: string | string[];
  error?: string;
  tools?: ToolActivity[];
  className?: string;
}) {
  const evidenceItems = typeof evidence === 'string' ? [evidence] : evidence;

  return (
    <Card className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">AI response</p>
        {confidence != null ? <AiConfidenceBadge value={confidence} /> : null}
      </div>
      <div className="text-sm text-foreground">{content}</div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <EvidencePanel items={evidenceItems} />
      {tools ? <ToolActivityIndicator tools={tools} /> : null}
    </Card>
  );
}
