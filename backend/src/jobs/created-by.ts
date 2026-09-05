import type { JobEnqueueOptions } from './queue.types';

export function resolveJobCreatedBy(
  payload: Record<string, unknown>,
  options: Pick<JobEnqueueOptions, 'createdBy'> = {},
): string | undefined {
  if (typeof options.createdBy === 'string') {
    const trimmed = options.createdBy.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const userId = payload.userId;
  if (typeof userId === 'string') {
    const trimmed = userId.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}
