import { describe, expect, it } from 'vitest';

import { ROLES } from '../rbac/catalog';
import { resolveJobCreatedBy } from './created-by';
import { canReadJobStatus, JobService } from './job.service';
import { InMemoryJobQueue } from './queue';

const owner = { id: 'owner-1', roles: [ROLES.MANAGER] };
const other = { id: 'other-1', roles: [ROLES.MANAGER] };
const admin = { id: 'admin-1', roles: [ROLES.ADMIN] };

describe('resolveJobCreatedBy', () => {
  it('prefers options.createdBy over payload.userId', () => {
    expect(
      resolveJobCreatedBy({ userId: 'from-payload' }, { createdBy: 'from-options' }),
    ).toBe('from-options');
  });

  it('reads payload.userId when options omit createdBy', () => {
    expect(resolveJobCreatedBy({ userId: 'user-9' })).toBe('user-9');
  });
});

describe('canReadJobStatus', () => {
  it('allows any jobs.read caller when the job has no owner', () => {
    expect(canReadJobStatus({ createdBy: undefined }, other)).toBe(true);
  });

  it('allows the owner and admin, and hides the job from other managers', () => {
    const record = { createdBy: owner.id };
    expect(canReadJobStatus(record, owner)).toBe(true);
    expect(canReadJobStatus(record, admin)).toBe(true);
    expect(canReadJobStatus(record, other)).toBe(false);
  });
});

describe('JobService', () => {
  it('returns 404 when another non-admin reads an owned job', async () => {
    const jobs = new InMemoryJobQueue();
    jobs.process('demo', async () => undefined);
    const jobId = await jobs.enqueue('demo', { userId: owner.id });
    await jobs.waitForIdle();

    const service = new JobService(jobs);
    await expect(service.getById(jobId, owner)).resolves.toMatchObject({ jobId, type: 'demo' });
    await expect(service.getById(jobId, other)).rejects.toMatchObject({
      message: 'Job not found',
    });
    await expect(service.getById(jobId, admin)).resolves.toMatchObject({ jobId });
    await jobs.close();
  });
});
