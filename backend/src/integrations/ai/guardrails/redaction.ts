import { AI_GUARDRAILS } from '../../../constants';
import { sanitizeErrorDetails, sanitizeErrorMessage } from '../../../errors/sanitize';

const PEM_PATTERN = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const WELL_KNOWN_TOKEN_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;

export function redactSensitiveValue(value: unknown): unknown {
  return sanitizeErrorDetails(value);
}

export function redactSensitiveText(value: string): string {
  return sanitizeErrorMessage(value)
    .replace(PEM_PATTERN, '[Redacted]')
    .replace(JWT_PATTERN, '[Redacted]')
    .replace(AWS_KEY_PATTERN, '[Redacted]')
    .replace(BEARER_PATTERN, 'Bearer [Redacted]')
    .replace(WELL_KNOWN_TOKEN_PATTERN, '[Redacted]');
}

export function truncateJson(value: unknown, maxChars = AI_GUARDRAILS.MAX_RESULT_CHARS): unknown {
  const redacted = redactSensitiveValue(value);
  const serialized = JSON.stringify(redacted);
  if (!serialized) {
    return redacted;
  }

  if (serialized.length <= maxChars) {
    return redacted;
  }

  return { truncated: true, preview: serialized.slice(0, maxChars) };
}

export function auditSafeRequest(value: unknown): unknown {
  return redactSensitiveValue(value) ?? {};
}
