export function withPoolParams(
  connectionString: string,
  poolMax: number,
  poolTimeoutSeconds: number,
): string {
  const url = new URL(connectionString);

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(poolMax));
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', String(poolTimeoutSeconds));
  }

  return url.toString();
}
