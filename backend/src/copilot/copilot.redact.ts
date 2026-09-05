import { COPILOT } from '../constants';
import { redactSensitiveText, redactSensitiveValue, truncateJson as truncateJsonValue } from '../integrations/ai/guardrails';

export function redactSecrets(value: unknown): unknown {
  return redactSensitiveValue(value);
}

export function redactText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return redactSensitiveText(trimmed).slice(0, COPILOT.MAX_MESSAGE_CHARS);
}

export function truncateJson(value: unknown, maxChars = COPILOT.MAX_RESULT_CHARS): unknown {
  return truncateJsonValue(value, maxChars);
}
