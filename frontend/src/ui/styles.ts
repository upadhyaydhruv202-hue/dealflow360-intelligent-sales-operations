export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

export const controlBase = cnControl(
  'w-full rounded-lg border border-edge bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm',
  'placeholder:text-foreground-muted',
  'disabled:cursor-not-allowed disabled:opacity-50',
  focusRing,
);

export const labelClass = 'block text-sm font-medium text-foreground';

export const helpClass = 'mt-1 text-xs text-foreground-muted';

export const errorClass = 'mt-1 text-xs text-danger';

function cnControl(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
