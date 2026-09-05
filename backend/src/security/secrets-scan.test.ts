import { describe, expect, it } from 'vitest';

import { findCommittedSecrets } from './secrets-scan';

describe('findCommittedSecrets', () => {
  it('flags private keys and provider tokens', () => {
    const findings = findCommittedSecrets([
      { path: 'backend/src/leak.ts', content: '-----BEGIN RSA PRIVATE KEY-----\nMIIE' },
      { path: 'backend/src/aws.ts', content: 'const key = "AKIAJOHNDOE123456789";' },
    ]);
    expect(findings.map((item) => item.reason)).toEqual(
      expect.arrayContaining(['PEM private key', 'AWS access key']),
    );
  });

  it('allows documented placeholders and example files', () => {
    const findings = findCommittedSecrets([
      {
        path: '.env.example',
        content: 'JWT_ACCESS_SECRET=local-dev-access-secret-change-me-32b\nSMTP_PASSWORD=\n',
      },
      {
        path: 'backend/tests/helpers/auth.ts',
        content: "JWT_ACCESS_SECRET: 'test-access-secret-not-for-production-32'",
      },
      {
        path: 'docs/configuration.md',
        content: 'JWT_ACCESS_SECRET is required in production',
      },
    ]);
    expect(findings).toEqual([]);
  });

  it('rejects a committed JWT secret assignment', () => {
    const findings = findCommittedSecrets([
      {
        path: 'backend/.env.local.copy',
        content: 'JWT_ACCESS_SECRET=super-secret-production-value-please-hide',
      },
    ]);
    expect(findings).toEqual([
      { path: 'backend/.env.local.copy', reason: 'Assigned secret value' },
    ]);
  });
});
