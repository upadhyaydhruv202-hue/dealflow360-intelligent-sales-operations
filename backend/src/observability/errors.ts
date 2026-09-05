import type { ErrorContext, ErrorTracker } from './types';

export class NoopErrorTracker implements ErrorTracker {
  captureException(_error: unknown, _context?: ErrorContext): void {}
}

export interface CapturedError {
  error: unknown;
  context?: ErrorContext;
}

export class MemoryErrorTracker implements ErrorTracker {
  readonly events: CapturedError[] = [];

  captureException(error: unknown, context?: ErrorContext): void {
    this.events.push({ error, context });
  }
}

/**
 * Wrap an external monitoring client (Sentry, Application Insights, and similar)
 * without making that vendor a required dependency.
 */
export function createErrorTracker(tracker?: ErrorTracker | null): ErrorTracker {
  return tracker ?? new NoopErrorTracker();
}
