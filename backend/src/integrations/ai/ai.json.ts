import { ValidationError } from '../../errors';

export function extractJson(text: string): unknown {
  const candidate = unwrapJsonCandidate(text);

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const sliced = sliceJsonObject(candidate);
    if (sliced) {
      try {
        return JSON.parse(sliced) as unknown;
      } catch {
        throw malformedJsonError();
      }
    }

    throw malformedJsonError();
  }
}

function unwrapJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw malformedJsonError();
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function sliceJsonObject(text: string): string | undefined {
  const start = text.search(/[{[]/);
  if (start < 0) {
    return undefined;
  }

  const endBrace = text.lastIndexOf('}');
  const endBracket = text.lastIndexOf(']');
  const end = Math.max(endBrace, endBracket);
  if (end <= start) {
    return undefined;
  }

  return text.slice(start, end + 1);
}

function malformedJsonError(): ValidationError {
  return new ValidationError('AI returned malformed JSON', [
    {
      path: 'ai',
      message: 'The model did not return valid JSON',
      code: 'invalid_json',
    },
  ]);
}
