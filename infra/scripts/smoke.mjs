#!/usr/bin/env node
/**
 * Smoke-check a running Compose stack.
 * Start the stack first: docker compose up --build -d --wait
 */

const API_BASE = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5000';
const FRONTEND_BASE = process.env.SMOKE_FRONTEND_URL ?? 'http://127.0.0.1:5173';

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`${url} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function getText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed: HTTP ${response.status}`);
  }
  return response.text();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const health = await getJson(`${API_BASE}/health`);
  assert(health.data?.status === 'ok', `health status was ${health.data?.status}`);

  const ready = await getJson(`${API_BASE}/ready`);
  assert(ready.data?.status === 'ready', `readiness status was ${ready.data?.status}`);
  assert(ready.data?.checks?.database?.healthy === true, 'database check was not healthy');
  assert(ready.data?.checks?.redis?.healthy === true, 'redis check was not healthy');
  assert(ready.data?.checks?.database?.skipped !== true, 'database check was skipped');
  assert(ready.data?.checks?.redis?.skipped !== true, 'redis check was skipped');

  const frontend = await getText(`${FRONTEND_BASE}/`);
  assert(
    frontend.includes('<div id="root">') || frontend.includes('DealFlow360'),
    'frontend did not serve the SPA',
  );

  const proxiedHealth = await getJson(`${FRONTEND_BASE}/health`);
  assert(proxiedHealth.data?.status === 'ok', 'frontend nginx did not proxy /health');

  const { execFileSync } = await import('node:child_process');
  const ps = execFileSync('docker', ['compose', 'ps', '--format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const rows = ps
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    });

  const byService = Object.fromEntries(rows.map((row) => [row.Service, row]));
  for (const name of ['postgres', 'redis', 'backend', 'worker', 'frontend']) {
    const row = byService[name];
    assert(row, `service ${name} is not running`);
    const state = `${row.State ?? ''} ${row.Health ?? ''} ${row.Status ?? ''}`.toLowerCase();
    assert(
      state.includes('running') || row.State === 'running',
      `service ${name} is not running (${row.State ?? row.Status})`,
    );
  }

  const worker = byService.worker;
  const workerHealth = `${worker.Health ?? worker.Status ?? ''}`.toLowerCase();
  assert(
    workerHealth.includes('healthy') || worker.State === 'running',
    `worker is not healthy (${worker.Health ?? worker.Status})`,
  );

  console.log(
    'Docker smoke checks passed: frontend, backend, worker, postgres, redis, /health, /ready.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
