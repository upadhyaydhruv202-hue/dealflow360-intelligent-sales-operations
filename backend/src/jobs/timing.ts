import { TimeoutError } from '../errors';

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  message = 'Background job timed out',
): Promise<T> {
  if (timeoutMs <= 0) {
    return work;
  }

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(message, { provider: 'jobs' }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function backoffDelay(backoffMs: number, attempt: number): number {
  if (backoffMs <= 0 || attempt <= 0) {
    return 0;
  }

  return backoffMs * 2 ** (attempt - 1);
}
