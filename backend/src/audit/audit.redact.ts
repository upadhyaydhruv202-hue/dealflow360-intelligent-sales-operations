import { AUDIT } from '../constants';
import { sanitizeErrorDetails, sanitizeErrorMessage } from '../errors/sanitize';

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const PEM_PATTERN = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g;
const SENSITIVE_KEY_PARTS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'otp',
  'otpcode',
  'authorization',
  'credential',
  'privatekey',
  'accesskey',
  'secretkey',
  'jwt',
]);

export function redactAuditValue(value: unknown): unknown {
  return truncateJson(redactNested(sanitizeErrorDetails(value)));
}

function isSensitiveAuditKey(key: string): boolean {
  const parts = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[^a-z0-9]+/i)
    .map((part) => part.toLowerCase())
    .filter(Boolean);

  if (parts.some((part) => SENSITIVE_KEY_PARTS.has(part))) {
    return true;
  }

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (SENSITIVE_KEY_PARTS.has(`${parts[i]}${parts[i + 1]}`)) {
      return true;
    }
  }

  return false;
}

function redactNested(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactNested(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = isSensitiveAuditKey(key) ? '[Redacted]' : redactNested(nested);
    }
    return output;
  }

  if (typeof value === 'string') {
    return redactAuditText(value);
  }

  return value;
}

export function redactAuditText(value: string): string {
  return sanitizeErrorMessage(value)
    .replace(PEM_PATTERN, '[Redacted]')
    .replace(JWT_PATTERN, '[Redacted]');
}

function truncateJson(value: unknown, maxChars = AUDIT.MAX_JSON_CHARS): unknown {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= maxChars) {
    return value;
  }

  return { truncated: true, preview: serialized.slice(0, maxChars) };
}
