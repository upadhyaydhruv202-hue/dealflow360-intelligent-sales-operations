#!/usr/bin/env node
/**
 * Optional post-deploy probe. Skips when HEALTHCHECK_URL is unset
 * and no remote apply ran. Webhook/command deploys require a probe URL.
 * See docs/ci-cd.md.
 */

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function probe(url, timeoutMs) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} HTTP ${response.status}`);
  }
  if (contentType.includes('application/json')) {
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${url} returned invalid JSON`);
    }
    if (body && body.success === false) {
      throw new Error(`${url} reported success=false`);
    }
    const status = body?.data?.status;
    if (status && status !== 'ok' && status !== 'ready') {
      throw new Error(`${url} status was ${status}`);
    }
  }
}

async function waitFor(url, name, retries, intervalMs, timeoutMs) {
  const endpoint = requireHttpUrl(url, name);
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await probe(endpoint, timeoutMs);
      console.log(`${name} passed on attempt ${attempt}: ${endpoint}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`${name} attempt ${attempt}/${retries} failed: ${lastError}`);
      if (attempt < retries) {
        await sleep(intervalMs);
      }
    }
  }
  fail(`${name} failed after ${retries} attempts: ${lastError}`);
}

async function main() {
  const provider = (process.env.DEPLOY_PROVIDER || 'none').trim().toLowerCase();
  const applied = provider === 'webhook' || provider === 'command';
  const healthUrl = (process.env.HEALTHCHECK_URL || '').trim();
  const readyUrl = (process.env.READYCHECK_URL || '').trim();
  if (!healthUrl && !readyUrl) {
    if (applied) {
      fail(`DEPLOY_PROVIDER=${provider} applied a release; set HEALTHCHECK_URL or READYCHECK_URL.`);
    }
    console.log('HEALTHCHECK_URL and READYCHECK_URL are unset; skipping remote health check.');
    return;
  }

  const retries = Math.max(1, Number(process.env.HEALTHCHECK_RETRIES || 12));
  const intervalMs = Math.max(250, Number(process.env.HEALTHCHECK_INTERVAL_MS || 5000));
  const timeoutMs = Math.max(1000, Number(process.env.HEALTHCHECK_TIMEOUT_MS || 5000));

  if (healthUrl) {
    await waitFor(healthUrl, 'HEALTHCHECK_URL', retries, intervalMs, timeoutMs);
  }
  if (readyUrl) {
    await waitFor(readyUrl, 'READYCHECK_URL', retries, intervalMs, timeoutMs);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
