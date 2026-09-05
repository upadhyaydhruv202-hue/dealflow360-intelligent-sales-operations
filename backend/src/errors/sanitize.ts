const SENSITIVE_KEY =
  /^(password|passwordhash|passwd|secret|token|accesstoken|refreshtoken|authorization|apikey|api_key|credential|connectionstring|databaseurl|privatekey|jwt|otp|otpcode|codehash)$/i;

const FILE_PATH_PATTERN = /(?:[A-Za-z]:\\[^\s"'`]+)|(?:\/(?:home|Users|var|tmp|opt|etc|usr|app|src)\/[^\s"'`]+)/g;

const SECRET_VALUE_PATTERN =
  /(?:api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['"]?[^'"\s]+/gi;

export function sanitizeErrorMessage(message: string): string {
  return message.replace(FILE_PATH_PATTERN, '[path]').replace(SECRET_VALUE_PATTERN, '[Redacted]').trim();
}

export function sanitizeErrorDetails(details: unknown): unknown {
  if (Array.isArray(details)) {
    return details.map((item) => sanitizeErrorDetails(item));
  }

  if (details && typeof details === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (SENSITIVE_KEY.test(key)) {
        output[key] = '[Redacted]';
        continue;
      }

      output[key] = sanitizeErrorDetails(value);
    }

    return output;
  }

  if (typeof details === 'string') {
    return sanitizeErrorMessage(details);
  }

  return details;
}
