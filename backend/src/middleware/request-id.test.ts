import { describe, expect, it } from 'vitest';

import {
  getAuditContext,
  getRequestId,
  runWithJobContext,
  runWithRequestContext,
  withRequestId,
} from '../utils/request-context';
import { resolveRequestId } from './request-id';

describe('request IDs', () => {
  it('reuses a safe incoming header and rejects malformed values', () => {
    expect(resolveRequestId('fixed-id')).toBe('fixed-id');
    expect(resolveRequestId('  abc.def:1-2  ')).toBe('abc.def:1-2');
    expect(resolveRequestId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(resolveRequestId('has spaces')).not.toBe('has spaces');
    expect(resolveRequestId('x'.repeat(200))).toHaveLength(36);
  });

  it('propagates the request ID through async context, jobs, and audit metadata', () => {
    expect(getRequestId()).toBeUndefined();

    runWithRequestContext({ requestId: 'req-123' }, () => {
      expect(getRequestId()).toBe('req-123');
      expect(getAuditContext()).toEqual({ requestId: 'req-123' });
      expect(withRequestId({ job: 'email.send' })).toEqual({
        job: 'email.send',
        requestId: 'req-123',
      });
    });

    expect(getRequestId()).toBeUndefined();

    runWithJobContext({ requestId: 'job-9' }, () => {
      expect(getRequestId()).toBe('job-9');
    });

    runWithJobContext({ requestId: 'job-9', jobId: 'abc' }, () => {
      expect(getAuditContext()).toEqual({ requestId: 'job-9', jobId: 'abc' });
    });
  });
});
