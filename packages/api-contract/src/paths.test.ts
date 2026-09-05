import { describe, expect, it } from 'vitest';

import { API_PATHS, API_PREFIX, API_ROUTE_PATHS, API_VERSION, OPERATIONAL_PATHS, apiUrl } from './paths';

describe('API paths', () => {
  it('keeps the versioned application prefix', () => {
    expect(API_PREFIX).toBe('/api/v1');
    expect(API_VERSION).toBe('v1');
    expect(API_PATHS.root).toBe('/api/v1');
    expect(apiUrl('/')).toBe('/api/v1');
  });

  it('keeps health and readiness outside /api/v1', () => {
    expect(OPERATIONAL_PATHS.health).toBe('/health');
    expect(OPERATIONAL_PATHS.ready).toBe('/ready');
    expect(OPERATIONAL_PATHS.health.startsWith(API_PREFIX)).toBe(false);
    expect(OPERATIONAL_PATHS.ready.startsWith(API_PREFIX)).toBe(false);
  });

  it('derives client paths from the same relative route catalog', () => {
    expect(API_PATHS.features).toBe('/api/v1/features');
    expect(API_PATHS.auth.login).toBe('/api/v1/auth/login');
    expect(API_PATHS.auth.root).toBe('/api/v1/auth');
    expect(API_PATHS.jobs.byId('job-1')).toBe('/api/v1/jobs/job-1');
    expect(API_PATHS.jobs.byId('a/b')).toBe('/api/v1/jobs/a%2Fb');
    expect(API_PATHS.realtime.events).toBe('/api/v1/realtime/events');
    expect(API_PATHS.realtime.channels).toBe('/api/v1/realtime/channels');
    expect(API_PATHS.search.root).toBe('/api/v1/search');
    expect(API_PATHS.search.indexes).toBe('/api/v1/search/indexes');
    expect(API_PATHS.search.documentById('kit.demo', 'a/b')).toBe(
      '/api/v1/search/documents/kit.demo/a%2Fb',
    );
    expect(API_PATHS.analytics.query).toBe('/api/v1/analytics/query');
    expect(API_PATHS.analytics.dashboardById('kit.demo')).toBe('/api/v1/analytics/dashboards/kit.demo');
    expect(API_PATHS.features).toBe(`${API_PREFIX}${API_ROUTE_PATHS.features}`);
    expect(API_PATHS.auth.login).toBe(
      `${API_PREFIX}${API_ROUTE_PATHS.auth.root}${API_ROUTE_PATHS.auth.login}`,
    );
  });
});
