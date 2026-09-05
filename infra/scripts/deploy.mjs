#!/usr/bin/env node
/**
 * Provider-agnostic deploy hook for GitHub Actions.
 *
 * Set DEPLOY_PROVIDER to none (default), webhook, or command.
 * Do not hardcode hosts, credentials, or cloud vendors in this file.
 * See docs/ci-cd.md.
 */

function fail(message) {
  console.error(message);
  process.exit(1);
}

function publicUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '(invalid url)';
  }
}

function requireHttpUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${name} is not a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(`${name} must be http or https`);
  }
  return parsed.toString();
}

function payload() {
  return {
    environment: process.env.DEPLOY_ENVIRONMENT || 'staging',
    backendImage: process.env.BACKEND_IMAGE || '',
    frontendImage: process.env.FRONTEND_IMAGE || '',
    gitSha: process.env.GIT_SHA || '',
    repository: process.env.GITHUB_REPOSITORY || '',
  };
}

async function deployNone() {
  const body = payload();
  console.log('DEPLOY_PROVIDER=none. Images were pushed to the registry; remote apply is skipped.');
  console.log(`environment=${body.environment}`);
  console.log(`backendImage=${body.backendImage}`);
  console.log(`frontendImage=${body.frontendImage}`);
  console.log(`gitSha=${body.gitSha}`);
  console.log(
    'Set vars.DEPLOY_PROVIDER to webhook or command to apply a release. See docs/ci-cd.md.',
  );
}

async function deployWebhook() {
  const url = process.env.DEPLOY_WEBHOOK_URL;
  if (!url) {
    fail('DEPLOY_PROVIDER=webhook requires secret DEPLOY_WEBHOOK_URL');
  }
  const endpoint = requireHttpUrl(url, 'DEPLOY_WEBHOOK_URL');
  const token = process.env.DEPLOY_WEBHOOK_TOKEN;
  const timeoutMs = Number(process.env.DEPLOY_WEBHOOK_TIMEOUT_MS || 15_000);
  const body = JSON.stringify(payload());
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  console.log(`POST deploy webhook ${publicUrl(endpoint)}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 15_000),
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`Deploy webhook failed: HTTP ${response.status}`);
  }
  console.log(`Deploy webhook accepted: HTTP ${response.status}`);
  if (text.trim()) {
    console.log('Webhook response received (body not logged).');
  }
}

async function deployCommand() {
  const command = process.env.DEPLOY_COMMAND;
  if (!command || !command.trim()) {
    fail('DEPLOY_PROVIDER=command requires vars.DEPLOY_COMMAND');
  }

  const { spawnSync } = await import('node:child_process');
  console.log('Running DEPLOY_COMMAND (value not logged).');
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.error) {
    fail(result.error.message);
  }
  process.exit(result.status ?? 1);
}

async function main() {
  const provider = (process.env.DEPLOY_PROVIDER || 'none').trim().toLowerCase();
  switch (provider) {
    case 'none':
    case '':
      await deployNone();
      return;
    case 'webhook':
      await deployWebhook();
      return;
    case 'command':
      await deployCommand();
      return;
    default:
      fail(
        `Unknown DEPLOY_PROVIDER="${provider}". Use none, webhook, or command. See docs/ci-cd.md.`,
      );
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
