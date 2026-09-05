import { execFile } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

async function runNodeScript(
  relativePath: string,
  env: NodeJS.ProcessEnv,
  options: { expectFailure?: boolean } = {},
): Promise<string> {
  try {
    const result = await execFileAsync(process.execPath, [path.join(repoRoot, relativePath)], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 15_000,
    });
    return `${result.stdout}${result.stderr}`;
  } catch (error) {
    if (options.expectFailure) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`;
    }
    throw error;
  }
}

async function listen(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('expected TCP address');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const SECRET_ASSIGNMENT =
  /\b(?:JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|OTP_HASH_SECRET|SMTP_PASSWORD|GEMINI_API_KEY|ODOO_API_KEY|RESEND_API_KEY|BREVO_API_KEY|SMS_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*=\s*\S+/;

const CLOUD_ACTIONS =
  /uses:\s*(aws-actions\/|azure\/|google-github-actions\/|superfly\/|akamai\/|digitalocean\/)/;

describe('CI workflow', () => {
  const ci = readRepoFile('.github/workflows/ci.yml');

  it('runs on pull requests, pushes to main, and reusable workflow calls', () => {
    expect(ci).toMatch(/^name:\s*CI/m);
    expect(ci).toMatch(/^\s+push:/m);
    expect(ci).toMatch(/branches:\s*\[main,\s*master\]/);
    expect(ci).toMatch(/^\s+pull_request:/m);
    expect(ci).toMatch(/^\s+workflow_call:/m);
  });

  it('checks out, caches npm, and installs dependencies', () => {
    expect(ci).toContain('actions/checkout@v7');
    expect(ci).toContain('actions/setup-node@v7');
    expect(ci).toMatch(/node-version-file:\s*\.nvmrc/);
    expect(ci).toMatch(/cache:\s*npm/);
    expect(ci).toMatch(/run:\s*npm ci/);
  });

  it('lints, typechecks, tests, audits, and builds frontend and backend', () => {
    expect(ci).toContain('npm run lint');
    expect(ci).toContain('npm run typecheck');
    expect(ci).toContain('npm run test:unit');
    expect(ci).toContain('npm run test:integration');
    expect(ci).toContain('npm run security:audit');
    expect(ci).toContain('npm run security:secrets');
    expect(ci).toContain('npm run build -w frontend');
    expect(ci).toContain('npm run build -w backend');
  });

  it('validates Docker production images and the Compose stack', () => {
    expect(ci).toContain('docker build -f backend/Dockerfile --target production');
    expect(ci).toContain('docker build -f frontend/Dockerfile --target production');
    expect(ci).toContain('docker compose up --build');
    expect(ci).toContain('--no-deps backend');
    expect(ci).toContain('infra/scripts/healthcheck.mjs');
    expect(ci).toContain('infra/scripts/smoke.mjs');
    expect(ci).toContain('.env.demo.example');
  });

  it('stores reports, coverage, and build artifacts', () => {
    expect(ci).toContain('actions/upload-artifact@v7');
    expect(ci).toContain('**/reports/**');
    expect(ci).toContain('**/coverage/**');
    expect(ci).toContain('frontend/dist/**');
    expect(ci).toContain('backend/dist/**');
    expect(ci).toContain('junit-unit.xml');
  });

  it('uses least-privilege permissions and PR concurrency without hardcoded secrets', () => {
    expect(ci).toMatch(/permissions:\s*\n\s+contents:\s*read/);
    expect(ci).toMatch(/persist-credentials:\s*false/);
    expect(ci).toContain('concurrency:');
    expect(ci).toContain('cancel-in-progress:');
    expect(ci).not.toMatch(SECRET_ASSIGNMENT);
    expect(ci).not.toMatch(CLOUD_ACTIONS);
    expect(ci).not.toMatch(/password:\s*['"][^$'{][^'"]+['"]/);
  });
});

describe('CD workflow', () => {
  const cd = readRepoFile('.github/workflows/cd.yml');

  it('supports manual dispatch and optional post-CI auto deploy', () => {
    expect(cd).toMatch(/^name:\s*CD/m);
    expect(cd).toContain('workflow_dispatch:');
    expect(cd).toContain('workflow_run:');
    expect(cd).toMatch(/workflows:\s*\[CI\]/);
    expect(cd).toContain('skip_verify');
    expect(cd).toContain('CD_AUTO_DEPLOY');
  });

  it('builds images, pushes to a configurable registry, deploys, and health-checks', () => {
    expect(cd).toContain('uses: ./.github/workflows/ci.yml');
    expect(cd).toContain('docker/build-push-action@v7');
    expect(cd).toContain('docker/login-action@v4');
    expect(cd).toContain('docker/setup-buildx-action@v4');
    expect(cd).toContain('ubuntu-24.04');
    expect(cd).toContain('infra/scripts/deploy.mjs');
    expect(cd).toContain('infra/scripts/healthcheck.mjs');
    expect(cd).toContain('secrets.REGISTRY_PASSWORD');
    expect(cd).toContain('secrets.GITHUB_TOKEN');
    expect(cd).toContain('vars.DEPLOY_PROVIDER');
    expect(cd).toContain('vars.HEALTHCHECK_URL');
    expect(cd).toMatch(/name:\s*Health check[\s\S]*DEPLOY_PROVIDER:[\s\S]*Probe health endpoints/);
  });

  it('prevents overlapping deploys and does not hardcode a cloud provider', () => {
    expect(cd).toContain('concurrency:');
    expect(cd).toMatch(/cancel-in-progress:\s*false/);
    expect(cd).toContain('packages: write');
    expect(cd).toContain('id-token: write');
    expect(cd).toMatch(/environment:\s*\n\s+name:/);
    expect(cd).not.toMatch(SECRET_ASSIGNMENT);
    expect(cd).not.toMatch(CLOUD_ACTIONS);
    expect(cd).not.toMatch(/password:\s*['"][^$'{][^'"]+['"]/);
  });
});

describe('Deploy hook', () => {
  it('no-ops when DEPLOY_PROVIDER is none', async () => {
    const output = await runNodeScript('infra/scripts/deploy.mjs', {
      DEPLOY_PROVIDER: 'none',
      BACKEND_IMAGE: 'ghcr.io/example/app/backend:sha-abc1234',
      FRONTEND_IMAGE: 'ghcr.io/example/app/frontend:sha-abc1234',
      GIT_SHA: 'abc1234',
      DEPLOY_ENVIRONMENT: 'staging',
    });
    expect(output).toMatch(/DEPLOY_PROVIDER=none/);
    expect(output).toContain('backend:sha-abc1234');
  });

  it('rejects unknown providers and missing webhook or command configuration', async () => {
    const unknown = await runNodeScript(
      'infra/scripts/deploy.mjs',
      { DEPLOY_PROVIDER: 'heroku' },
      { expectFailure: true },
    );
    expect(unknown).toMatch(/Unknown DEPLOY_PROVIDER/i);

    const webhook = await runNodeScript(
      'infra/scripts/deploy.mjs',
      { DEPLOY_PROVIDER: 'webhook' },
      { expectFailure: true },
    );
    expect(webhook).toMatch(/DEPLOY_WEBHOOK_URL/);

    const command = await runNodeScript(
      'infra/scripts/deploy.mjs',
      { DEPLOY_PROVIDER: 'command' },
      { expectFailure: true },
    );
    expect(command).toMatch(/DEPLOY_COMMAND/);
  });

  it('runs DEPLOY_COMMAND when the command provider is selected', async () => {
    const output = await runNodeScript('infra/scripts/deploy.mjs', {
      DEPLOY_PROVIDER: 'command',
      DEPLOY_COMMAND: 'echo deploy-ok',
    });
    expect(output).toContain('deploy-ok');
  });

  it('posts an image payload to a webhook and does not log the token', async () => {
    const server = await listen((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
      }
      let raw = '';
      req.on('data', (chunk: Buffer) => {
        raw += chunk.toString('utf8');
      });
      req.on('end', () => {
        const authorization = req.headers.authorization;
        const body = JSON.parse(raw) as { backendImage?: string };
        const ok = authorization === 'Bearer test-token' && Boolean(body.backendImage);
        res.writeHead(ok ? 202 : 400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: ok }));
      });
    });
    try {
      const output = await runNodeScript('infra/scripts/deploy.mjs', {
        DEPLOY_PROVIDER: 'webhook',
        DEPLOY_WEBHOOK_URL: server.url,
        DEPLOY_WEBHOOK_TOKEN: 'test-token',
        BACKEND_IMAGE: 'example/backend:sha-1',
        FRONTEND_IMAGE: 'example/frontend:sha-1',
        GIT_SHA: '1',
        DEPLOY_ENVIRONMENT: 'staging',
      });
      expect(output).toMatch(/HTTP 202/);
      expect(output).not.toContain('test-token');
    } finally {
      await server.close();
    }
  });
});

describe('Health check hook', () => {
  it('skips when no probe URLs are configured', async () => {
    const output = await runNodeScript('infra/scripts/healthcheck.mjs', {
      HEALTHCHECK_URL: '',
      READYCHECK_URL: '',
      DEPLOY_PROVIDER: 'none',
    });
    expect(output).toMatch(/skipping remote health check/i);
  });

  it('fails closed after webhook or command apply when no probe URL is set', async () => {
    const webhook = await runNodeScript(
      'infra/scripts/healthcheck.mjs',
      { DEPLOY_PROVIDER: 'webhook', HEALTHCHECK_URL: '', READYCHECK_URL: '' },
      { expectFailure: true },
    );
    expect(webhook).toMatch(/HEALTHCHECK_URL or READYCHECK_URL/);

    const command = await runNodeScript(
      'infra/scripts/healthcheck.mjs',
      { DEPLOY_PROVIDER: 'command', HEALTHCHECK_URL: '', READYCHECK_URL: '' },
      { expectFailure: true },
    );
    expect(command).toMatch(/HEALTHCHECK_URL or READYCHECK_URL/);
  });

  it('accepts JSON health envelopes and retries until success', async () => {
    let hits = 0;
    const server = await listen((_req, res) => {
      hits += 1;
      const ready = hits >= 2;
      res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: ready, data: { status: ready ? 'ok' : 'starting' } }));
    });
    try {
      const output = await runNodeScript('infra/scripts/healthcheck.mjs', {
        HEALTHCHECK_URL: `${server.url}/health`,
        HEALTHCHECK_RETRIES: '5',
        HEALTHCHECK_INTERVAL_MS: '50',
        HEALTHCHECK_TIMEOUT_MS: '1000',
      });
      expect(output).toMatch(/passed on attempt 2/);
      expect(hits).toBeGreaterThanOrEqual(2);
    } finally {
      await server.close();
    }
  });
});
