import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

import { ExternalServiceError, ValidationError } from '../errors';

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost', '.lan', '.home', '.corp'];
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set([80, 443]);

export interface SafeExternalUrlOptions {
  field?: string;
  allowHttp?: boolean;
  allowNonDefaultPorts?: boolean;
}

export function assertHttpUrl(value: string, field = 'url'): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError('URL is invalid', [
      { path: field, message: 'URL must be a valid http(s) address', code: 'custom' },
    ]);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError('URL protocol is not allowed', [
      { path: field, message: 'Only http and https URLs are allowed', code: 'custom' },
    ]);
  }

  if (parsed.username || parsed.password) {
    throw new ValidationError('URL credentials are not allowed', [
      { path: field, message: 'URLs must not include embedded credentials', code: 'custom' },
    ]);
  }

  return parsed;
}

export function assertSafeExternalUrl(value: string, options: SafeExternalUrlOptions = {}): URL {
  const field = options.field ?? 'url';
  const parsed = assertHttpUrl(value, field);

  if (parsed.protocol === 'http:' && options.allowHttp === false) {
    throw new ValidationError('URL protocol is not allowed', [
      { path: field, message: 'Only https URLs are allowed', code: 'custom' },
    ]);
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (!options.allowNonDefaultPorts && !ALLOWED_PORTS.has(port)) {
    throw new ValidationError('URL port is not allowed', [
      { path: field, message: 'Only ports 80 and 443 are allowed', code: 'custom' },
    ]);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isBlockedHost(host)) {
    throw new ValidationError('URL host is not allowed', [
      { path: field, message: 'Private, loopback, link-local, and metadata hosts are blocked', code: 'custom' },
    ]);
  }

  return parsed;
}

export function isBlockedHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(normalized) || normalized === '0.0.0.0' || normalized === '::' || normalized === '::1') {
    return true;
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  if (/^\d+$/.test(normalized)) {
    return true;
  }

  const mappedIpv4 = ipv4MappedFromIpv6(normalized);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4);
  }

  if (isIpv4(normalized)) {
    return isPrivateIpv4(normalized);
  }

  return (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('ff')
  );
}

export async function fetchExternal(
  url: string,
  init: RequestInit & {
    timeoutMs: number;
    field?: string;
    fetchImpl?: typeof fetch;
    lookup?: DnsLookup;
    allowHttp?: boolean;
    allowNonDefaultPorts?: boolean;
  },
): Promise<Response> {
  const resolved = await resolveSafeExternalUrl(url, {
    field: init.field,
    allowHttp: init.allowHttp,
    allowNonDefaultPorts: init.allowNonDefaultPorts,
    lookup: init.lookup,
  });
  const pinnedAddress = resolved.addresses[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  const requestInit: RequestInit & { pinnedAddress: string } = {
    method: init.method ?? 'POST',
    headers: init.headers,
    body: init.body,
    redirect: init.redirect ?? 'error',
    signal: init.signal ?? controller.signal,
    pinnedAddress,
  };

  try {
    if (init.fetchImpl) {
      return await init.fetchImpl(resolved.url.href, requestInit);
    }

    return await pinnedNodeFetch(resolved.url, pinnedAddress, requestInit);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ExternalServiceError) {
      throw error;
    }

    throw new ExternalServiceError('External request failed');
  } finally {
    clearTimeout(timer);
  }
}

export type DnsLookup = (hostname: string) => Promise<string[]>;

export interface ResolvedSafeUrl {
  url: URL;
  addresses: string[];
}

export async function resolveSafeExternalUrl(
  value: string,
  options: SafeExternalUrlOptions & { lookup?: DnsLookup } = {},
): Promise<ResolvedSafeUrl> {
  const parsed = assertSafeExternalUrl(value, options);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isLiteralIpHost(host)) {
    return { url: parsed, addresses: [host] };
  }

  let addresses: string[];
  try {
    addresses = await (options.lookup ?? defaultDnsLookup)(host);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ExternalServiceError('External request failed');
  }

  if (addresses.length === 0 || addresses.some((address) => isBlockedHost(address))) {
    throw new ValidationError('URL host is not allowed', [
      {
        path: options.field ?? 'url',
        message: 'Private, loopback, link-local, and metadata hosts are blocked',
        code: 'custom',
      },
    ]);
  }

  return { url: parsed, addresses };
}

export async function assertResolvedSafeExternalUrl(
  value: string,
  options: SafeExternalUrlOptions & { lookup?: DnsLookup } = {},
): Promise<URL> {
  const resolved = await resolveSafeExternalUrl(value, options);
  return resolved.url;
}

export function createPinnedLookup(address: string): LookupFunction {
  const family = address.includes(':') ? 6 : 4;
  const lookup = ((
    _hostname: string,
    options: unknown,
    callback?: (
      err: Error | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number,
    ) => void,
  ) => {
    const cb = typeof options === 'function' ? options : callback;
    if (typeof cb !== 'function') {
      return;
    }
    const all =
      typeof options === 'object' && options !== null && 'all' in options
        ? Boolean((options as { all?: boolean }).all)
        : false;
    if (all) {
      cb(null, [{ address, family }]);
      return;
    }
    cb(null, address, family);
  }) as LookupFunction;
  return lookup;
}

async function pinnedNodeFetch(
  url: URL,
  address: string,
  init: RequestInit,
): Promise<Response> {
  const transport = url.protocol === 'https:' ? https : http;
  const agent = new transport.Agent({ lookup: createPinnedLookup(address) });
  const method = init.method ?? 'GET';
  const headers = toNodeHeaders(init.headers);

  try {
    return await new Promise<Response>((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method,
          headers,
          agent,
          signal: init.signal ?? undefined,
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if ((init.redirect ?? 'error') === 'error' && status >= 300 && status < 400) {
            res.resume();
            reject(new ExternalServiceError('External request failed'));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on('end', () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value === undefined) {
                continue;
              }
              responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
            }
            resolve(
              new Response(Buffer.concat(chunks), {
                status,
                headers: responseHeaders,
              }),
            );
          });
        },
      );
      req.on('error', reject);
      if (init.body !== undefined && init.body !== null) {
        req.write(init.body);
      }
      req.end();
    });
  } finally {
    agent.destroy();
  }
}

function toNodeHeaders(headers: RequestInit['headers']): http.OutgoingHttpHeaders {
  if (!headers) {
    return {};
  }
  const normalized = new Headers(headers);
  const result: http.OutgoingHttpHeaders = {};
  normalized.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function defaultDnsLookup(hostname: string): Promise<string[]> {
  const results = await dnsLookup(hostname, { all: true });
  return results.map((entry) => entry.address);
}

function isLiteralIpHost(host: string): boolean {
  return isIpv4(host) || host.includes(':');
}

function isIpv4(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

function ipv4MappedFromIpv6(host: string): string | undefined {
  const match = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (match) {
    return match[1];
  }

  const hexMatch = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hexMatch) {
    return undefined;
  }

  const high = Number.parseInt(hexMatch[1], 16);
  const low = Number.parseInt(hexMatch[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}
