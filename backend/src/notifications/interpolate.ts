const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g, (_match, path: string) => {
    const value = readDataPath(data, path);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  });
}

export function readDataPath(data: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = data;
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      return undefined;
    }
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
