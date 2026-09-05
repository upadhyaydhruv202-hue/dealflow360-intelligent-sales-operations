export interface ScannedFile {
  path: string;
  content: string;
}

export interface SecretFinding {
  path: string;
  reason: string;
}

const SKIP_PATH =
  /(^|\/)(node_modules|coverage|dist|build|docker-data|\.git)\//i;

const SKIP_EXTENSION = /\.(lock|svg|png|jpg|jpeg|gif|webp|woff2?|map|pdf)$/i;

const SKIP_NAME = /(\.example$|\.md$|\.mdc$|\.test\.ts$|\.spec\.ts$)/i;

const ALLOWED_VALUE =
  /(change-me|not-for-production|placeholder|example|dummy|your-|local-dev|test-|replace-me|todo|sample|xxxxx|abc123)/i;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const PATTERNS: Array<{ reason: string; regex: RegExp }> = [
  { reason: 'PEM private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { reason: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { reason: 'GitHub token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/ },
  { reason: 'GitHub fine-grained token', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { reason: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { reason: 'Stripe live secret', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { reason: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    reason: 'Assigned secret value',
    regex:
      /\b(?:JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|OTP_HASH_SECRET|SMTP_PASSWORD|GEMINI_API_KEY|ODOO_API_KEY|RESEND_API_KEY|BREVO_API_KEY|SMS_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*[:=]\s*['"]?([^\s'",;]+)['"]?/g,
  },
];

export function findCommittedSecrets(files: readonly ScannedFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const file of files) {
    const normalized = file.path.replaceAll('\\', '/');
    if (SKIP_PATH.test(normalized) || SKIP_EXTENSION.test(normalized) || SKIP_NAME.test(normalized)) {
      continue;
    }

    for (const pattern of PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match = regex.exec(file.content);
      while (match) {
        const assigned = match[1];
        const haystack = assigned ?? match[0];
        if (
          !haystack ||
          ALLOWED_VALUE.test(haystack) ||
          (assigned !== undefined && IDENTIFIER.test(assigned)) ||
          (assigned !== undefined && assigned.length < 12)
        ) {
          match = regex.exec(file.content);
          continue;
        }

        findings.push({ path: normalized, reason: pattern.reason });
        break;
      }
    }
  }

  return findings;
}
