import { describe, expect, it } from 'vitest';

import { DEFAULT_ARCHITECTURE_MODE, PROFILE_NAMES, uniqueSortedNames } from '../capabilities';
import { recommendCapabilities } from './engine';
import {
  analysisBackgroundJobs,
  analysisDefaultArchitecture,
  analysisEventStreaming,
  analysisLargeScaleSearch,
  analysisMicroservicesAndK8s,
  analysisOdooAndAi,
  analysisSemanticSearch,
  analysisSimpleSearch,
  analysisTimeSeriesAnalytics,
} from './fixtures';
import { OUT_OF_CATALOG } from './types';
import type { CapabilityRecommendationInput, RecommendationItem } from './types';

function names(items: readonly RecommendationItem[]): string[] {
  return items.map((item) => item.capabilitySelected);
}

function everyItemComplete(items: readonly RecommendationItem[]): void {
  for (const item of items) {
    expect(item.requirementSatisfied.length).toBeGreaterThan(0);
    expect(item.capabilitySelected.length).toBeGreaterThan(0);
    expect(item.reason.length).toBeGreaterThan(0);
    expect(item.dependencyImpact).toEqual(
      expect.objectContaining({
        adds: expect.any(Array),
        optional: expect.any(Array),
        missingIfSelected: expect.any(Array),
      }),
    );
    expect(item.complexityImpact).toMatch(/^(none|low|medium|high)$/);
    expect(item.securityImpact).toMatch(/^(none|low|medium|high)$/);
    expect(item.confidence).toBeGreaterThan(0);
    expect(item.confidence).toBeLessThanOrEqual(1);
    expect(item.alternative.name.length).toBeGreaterThan(0);
    expect(item.alternative.reason.length).toBeGreaterThan(0);
    expect(item.advisory).toBe(true);
  }
}

describe('recommendCapabilities (deterministic known inputs)', () => {
  it('recommends PostgreSQL for simple search and does not add RAG or Elasticsearch', () => {
    const result = recommendCapabilities(analysisSimpleSearch());

    expect(result.advisory).toBe(true);
    expect(result.humanSelectionAuthoritative).toBe(true);
    expect(result.enabledNothing).toBe(true);
    expect(result.selected.infrastructure).toContain('infrastructure.postgres');
    expect(result.selected.capabilities).toContain('database');
    expect(result.selected.capabilities).toContain('search');
    expect(result.selected.adapters).toContain('adapter.search.postgres');
    expect(result.selected.capabilities).not.toContain('rag');
    expect(result.selected.capabilities).not.toContain('sms');
    expect(result.rejected.map((item) => item.capabilitySelected)).toContain(OUT_OF_CATALOG.elasticsearch);
    expect(result.selected.architectureMode).toBe(DEFAULT_ARCHITECTURE_MODE);
    expect(result.resolution.valid).toBe(true);
    expect(result.featureFlags.some((flag) => flag.name === 'FEATURE_SEARCH' && flag.suggested)).toBe(true);
    expect(result.featureFlags.every((flag) => flag.name !== 'FEATURE_RAG')).toBe(true);
  });

  it('recommends AnalyticsService on PostgreSQL and does not add ClickHouse', () => {
    const result = recommendCapabilities(analysisTimeSeriesAnalytics());
    expect(result.selected.capabilities).toContain('analytics');
    expect(result.selected.adapters).toContain('adapter.analytics.postgres');
    expect(result.selected.infrastructure).not.toContain(OUT_OF_CATALOG.clickhouse);
    expect(names(result.rejected)).toContain(OUT_OF_CATALOG.clickhouse);
    expect(result.featureFlags.some((flag) => flag.name === 'FEATURE_ANALYTICS' && flag.suggested)).toBe(true);
  });

  it('recommends RAG for semantic search, not Elasticsearch, and does not select pgvector', () => {
    const result = recommendCapabilities(analysisSemanticSearch());

    expect(result.selected.capabilities).toContain('rag');
    expect(result.selected.capabilities).toContain('ai');
    expect(result.selected.infrastructure).toContain('infrastructure.postgres');
    expect(result.selected.adapters.some((name) => name.startsWith('adapter.rag.vector'))).toBe(true);
    expect(result.selected.capabilities).not.toContain(OUT_OF_CATALOG.pgvector);
    expect(names(result.rejected)).toEqual(
      expect.arrayContaining([OUT_OF_CATALOG.elasticsearch, OUT_OF_CATALOG.pgvector]),
    );
    expect(result.capabilities.find((item) => item.capabilitySelected === 'rag')?.alternative.name).toBe(
      'database',
    );
  });

  it('keeps large-scale search on PostgreSQL and does not add Elasticsearch', () => {
    const result = recommendCapabilities(analysisLargeScaleSearch());

    expect(result.selected.infrastructure).toContain('infrastructure.postgres');
    expect(result.selected.capabilities).toContain('database');
    expect(result.selected.capabilities).toContain('search');
    expect(result.selected.capabilities).not.toContain('rag');
    expect(names(result.rejected)).toContain(OUT_OF_CATALOG.elasticsearch);
    expect(result.selected.infrastructure).not.toContain(OUT_OF_CATALOG.elasticsearch);
  });

  it('recommends the existing job system for background work, not Kafka', () => {
    const result = recommendCapabilities(analysisBackgroundJobs());

    expect(result.selected.capabilities).toContain('jobs');
    expect(result.selected.capabilities).not.toContain(OUT_OF_CATALOG.kafka);
    expect(names(result.rejected)).toContain(OUT_OF_CATALOG.kafka);
    const jobs = result.capabilities.find((item) => item.capabilitySelected === 'jobs');
    expect(jobs?.alternative.name).toBe(OUT_OF_CATALOG.kafka);
  });

  it('does not add Kafka for distributed event streaming; recommends events plus jobs', () => {
    const result = recommendCapabilities(analysisEventStreaming());

    expect(result.selected.capabilities).toContain('jobs');
    expect(result.selected.capabilities).toContain('events');
    expect(result.selected.capabilities).not.toContain(OUT_OF_CATALOG.kafka);
    expect(names(result.rejected)).toContain(OUT_OF_CATALOG.kafka);
  });

  it('defaults to modular monolith, local-hybrid, and Basic Web', () => {
    const result = recommendCapabilities(analysisDefaultArchitecture());

    expect(result.selected.architectureMode).toBe(DEFAULT_ARCHITECTURE_MODE);
    expect(result.selected.deploymentMode).toBe('deployment.local-hybrid');
    expect(result.selected.profiles).toContain(PROFILE_NAMES.basicWeb);
    expect(result.selected.capabilities).toContain('auth');
    expect(result.selected.capabilities).not.toContain('analytics');
    expect(result.selected.capabilities).not.toContain('architecture.microservices');
    expect(result.selected.adapters).not.toContain('adapter.storage.s3');
    expect(result.architectureMode.alternative.name).toBe('architecture.microservices');
  });

  it('recommends Odoo and AI without SMS, S3, or Kubernetes', () => {
    const result = recommendCapabilities(analysisOdooAndAi());

    expect(result.selected.capabilities).toContain('odoo');
    expect(result.selected.capabilities).toContain('ai');
    expect(result.selected.capabilities).toContain('ai.summarization');
    expect(result.selected.adapters).toContain('adapter.odoo.json2');
    expect(result.selected.profiles).toEqual(
      expect.arrayContaining([PROFILE_NAMES.basicWeb, PROFILE_NAMES.aiApplication, PROFILE_NAMES.odooApplication]),
    );
    expect(result.selected.capabilities).not.toContain('sms');
    expect(result.selected.adapters).not.toContain('adapter.storage.s3');
    expect(result.selected.deploymentMode).not.toBe('deployment.kubernetes');
    expect(result.featureFlags.map((flag) => flag.name)).toEqual(
      expect.arrayContaining(['FEATURE_AI', 'FEATURE_ODOO']),
    );
    expect(result.featureFlags.map((flag) => flag.name)).not.toContain('FEATURE_SMS');
  });

  it('rejects microservices and Kubernetes even when the analysis names them', () => {
    const result = recommendCapabilities(analysisMicroservicesAndK8s());

    expect(result.selected.architectureMode).toBe(DEFAULT_ARCHITECTURE_MODE);
    expect(result.selected.capabilities).not.toContain('architecture.microservices');
    expect(result.selected.deploymentMode).not.toBe('deployment.kubernetes');
    expect(names(result.rejected)).toEqual(
      expect.arrayContaining(['architecture.microservices', 'deployment.kubernetes']),
    );
  });

  it('returns identical JSON when mapping order is shuffled', () => {
    const source = analysisDefaultArchitecture();
    const shuffled: CapabilityRecommendationInput = {
      ...source,
      mappings: [...(source.mappings ?? [])].reverse(),
    };

    const left = recommendCapabilities(source);
    const right = recommendCapabilities(shuffled);

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left.selected.capabilities).toEqual(uniqueSortedNames(left.selected.capabilities));
    expect(left.selected.profiles).toEqual(uniqueSortedNames(left.selected.profiles));
  });

  it('fills the required fields on every recommendation', () => {
    const result = recommendCapabilities(analysisSemanticSearch());
    everyItemComplete([
      result.architectureMode,
      result.deploymentMode,
      ...result.profiles,
      ...result.capabilities,
      ...result.adapters,
      ...result.infrastructure,
      ...result.rejected,
    ]);
  });

  it('does not treat resolver missing names as an automatic include of Kafka or Elasticsearch', () => {
    const result = recommendCapabilities(analysisSimpleSearch());
    expect(result.resolution.missing).not.toContain(OUT_OF_CATALOG.kafka);
    expect(result.resolution.missing).not.toContain(OUT_OF_CATALOG.elasticsearch);
    expect(result.resolution.selected).not.toContain(OUT_OF_CATALOG.kafka);
  });
});
