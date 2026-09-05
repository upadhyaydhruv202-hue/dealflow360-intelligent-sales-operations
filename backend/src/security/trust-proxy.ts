export type TrustProxySetting = boolean | number | string;

export function parseTrustProxy(value: string | undefined): TrustProxySetting {
  if (value === undefined) {
    return false;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'false' || trimmed === '0' || trimmed === 'off') {
    return false;
  }
  if (trimmed === 'true' || trimmed === 'on') {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return value.trim();
}
