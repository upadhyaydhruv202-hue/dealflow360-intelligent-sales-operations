import { z } from 'zod';

import { ValidationError } from '../../errors';
import type { AIService } from '../../integrations/ai';
import type { DocumentIntelligenceService } from '../../integrations/documents';
import type { OdooService } from '../../integrations/odoo';
import type { PdfService } from '../../integrations/pdf';
import type { RagService } from '../../integrations/rag';
import type { SearchService } from '../../integrations/search';
import type { AnalyticsService } from '../../integrations/analytics';
import type { AnomalyService } from '../../anomaly';
import { PERMISSIONS } from '../../rbac/catalog';
import { idSchema } from '../../schemas/common';
import type { NotificationService } from '../../notifications';
import type { CopilotToolRegistry } from '../copilot.registry';
import { defineCopilotTool } from '../copilot.types';

export interface BuiltinCopilotToolDeps {
  notifications?: NotificationService | null;
  pdf?: PdfService | null;
  documents?: DocumentIntelligenceService | null;
  odoo?: OdooService | null;
  ai?: AIService | null;
  rag?: RagService | null;
  search?: SearchService | null;
  analytics?: AnalyticsService | null;
  anomaly?: AnomalyService | null;
}

export function registerBuiltinCopilotTools(
  registry: CopilotToolRegistry,
  deps: BuiltinCopilotToolDeps,
): void {
  if (deps.notifications) {
    registry.register(listNotificationsTool(deps.notifications));
    registry.register(createNotificationTool(deps.notifications));
  }

  if (deps.pdf) {
    registry.register(generateReportTool(deps.pdf));
  }

  if (deps.documents && deps.ai) {
    registry.register(summarizeDocumentTool(deps.documents, deps.ai));
    registry.register(getDocumentTool(deps.documents));
  }

  if (deps.odoo?.enabled) {
    registry.register(searchOdooRecordsTool(deps.odoo));
  }

  if (deps.rag) {
    registry.register(searchKnowledgeTool(deps.rag));
  }

  if (deps.search) {
    registry.register(searchRecordsTool(deps.search));
  }

  if (deps.analytics) {
    registry.register(queryAnalyticsTool(deps.analytics));
  }

  if (deps.anomaly) {
    registry.register(detectAnomalyTool(deps.anomaly));
  }
}

function listNotificationsTool(notifications: NotificationService) {
  return defineCopilotTool({
    name: 'listNotifications',
    description: 'List the current user in-app notifications.',
    requiredPermission: PERMISSIONS.NOTIFICATIONS_READ,
    riskLevel: 'low',
    inputSchema: z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input, context) => {
      const result = await notifications.listForUser(context.user.id, input);
      return {
        items: result.items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          readAt: item.readAt,
        })),
        meta: result.meta,
      };
    },
  });
}

function createNotificationTool(notifications: NotificationService) {
  return defineCopilotTool({
    name: 'createNotification',
    description: 'Create an in-app notification. Email delivery is treated as high-risk external messaging.',
    requiredPermission: PERMISSIONS.NOTIFICATIONS_WRITE,
    riskLevel: 'medium',
    needsConfirmation: (input) => input.email === true,
    inputSchema: z.object({
      type: z.enum(['info', 'success', 'warning', 'error']).optional(),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(4000),
      email: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      return notifications.notify({
        userId: context.user.id,
        type: input.type,
        title: input.title,
        body: input.body,
        email: input.email,
      });
    },
  });
}

function generateReportTool(pdf: PdfService) {
  return defineCopilotTool({
    name: 'generateReport',
    description: 'Generate a PDF report from a title and sections and store it.',
    requiredPermission: PERMISSIONS.REPORTS_GENERATE,
    riskLevel: 'low',
    inputSchema: z.object({
      title: z.string().trim().min(1).max(120),
      sections: z
        .array(
          z.object({
            heading: z.string().trim().min(1).max(120).optional(),
            lines: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
          }),
        )
        .max(20)
        .optional(),
      filename: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[A-Za-z0-9._-]+\.pdf$/)
        .optional(),
    }),
    handler: async (input) => pdf.generate(input),
  });
}

function summarizeDocumentTool(documents: DocumentIntelligenceService, ai: AIService) {
  return defineCopilotTool({
    name: 'summarizeDocument',
    description: 'Summarize an analyzed document that the current user can read.',
    requiredPermission: PERMISSIONS.DOCUMENTS_READ,
    riskLevel: 'low',
    inputSchema: z.object({
      documentId: idSchema,
    }),
    handler: async (input, context) => {
      const document = await documents.getResult(input.documentId, context.user.id);
      const content = JSON.stringify({
        documentType: document.documentType,
        status: document.status,
        fields: document.fields,
      });
      const summary = await ai.summarize({ content, style: 'brief', length: 'short' });
      return {
        documentId: document.id,
        status: document.status,
        summary: summary.data,
      };
    },
  });
}

function getDocumentTool(documents: DocumentIntelligenceService) {
  return defineCopilotTool({
    name: 'getDocument',
    description: 'Fetch analyzed document fields for a document owned by the current user.',
    requiredPermission: PERMISSIONS.DOCUMENTS_READ,
    riskLevel: 'low',
    inputSchema: z.object({
      documentId: idSchema,
    }),
    handler: async (input, context) => documents.getResult(input.documentId, context.user.id),
  });
}

function searchOdooRecordsTool(odoo: OdooService) {
  return defineCopilotTool({
    name: 'searchOdooRecords',
    description:
      'Read Odoo records through a registered capability allowlist. Arbitrary models and methods are rejected.',
    requiredPermission: PERMISSIONS.ODOO_READ,
    riskLevel: 'low',
    inputSchema: z.object({
      capability: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-z][a-z0-9._-]*$/),
      method: z.enum(['search', 'search_read', 'read', 'search_count']).default('search_read'),
      params: z.record(z.string().min(1).max(64), z.unknown()).optional(),
    }),
    handler: async (input, context) => {
      const capability = odoo.capabilities.get(input.capability);
      if (!capability) {
        throw new ValidationError('Odoo capability is not allowlisted', [
          { path: 'capability', message: `Unknown capability "${input.capability}"`, code: 'custom' },
        ]);
      }

      return odoo.execute({
        user: context.user,
        capability: input.capability,
        method: input.method ?? 'search_read',
        params: input.params,
      });
    },
  });
}

function detectAnomalyTool(anomaly: AnomalyService) {
  return defineCopilotTool({
    // Must not start with "eval" — FORBIDDEN_AI_TOOL_NAME treats that as arbitrary execution.
    name: 'detectAnomaly',
    description:
      'Run statistical anomaly detection on a numeric series. Detection is deterministic; AI is not used to decide whether a point is anomalous.',
    requiredPermission: PERMISSIONS.ANOMALY_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      metric: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
      points: z.array(z.number().finite()).min(1).max(500),
      explain: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const result = await anomaly.evaluate({
        metric: input.metric,
        points: input.points,
        explain: input.explain,
        userId: context.user.id,
      });
      return {
        metric: result.metric,
        anomaly: result.anomaly,
        severity: result.severity,
        change: result.change,
        evidence: {
          sampleSize: result.evidence.sampleSize,
          latest: result.evidence.latest,
          baseline: result.evidence.baseline,
          fired: result.evidence.fired,
          insufficientData: result.evidence.insufficientData,
          claimsStatisticalSignificance: result.evidence.claimsStatisticalSignificance,
        },
        explanation: result.explanation,
        recommendedAction: result.recommendedAction,
      };
    },
  });
}

function searchKnowledgeTool(rag: RagService) {
  return defineCopilotTool({
    name: 'searchKnowledge',
    description: 'Semantically search indexed RAG documents. Returns retrieved chunks with source references.',
    requiredPermission: PERMISSIONS.RAG_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      query: z.string().trim().min(1).max(2000),
      topK: z.number().int().min(1).max(20).optional(),
    }),
    handler: async (input, context) => {
      const result = await rag.search({
        query: input.query,
        topK: input.topK,
        userId: context.user.id,
      });
      return {
        chunks: result.chunks.map((chunk) => ({
          documentId: chunk.documentId,
          chunkId: chunk.chunkId,
          source: chunk.source,
          content: chunk.content,
          score: chunk.score,
        })),
      };
    },
  });
}

function searchRecordsTool(search: SearchService) {
  return defineCopilotTool({
    name: 'searchRecords',
    description:
      'Search indexed application records with keyword, full-text, or fuzzy matching plus filters. Not semantic RAG and not Elasticsearch.',
    requiredPermission: PERMISSIONS.SEARCH_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      query: z.string().trim().max(500).optional(),
      index: z.string().trim().min(1).max(64).optional(),
      mode: z.enum(['auto', 'keyword', 'fulltext', 'fuzzy']).optional(),
      pageSize: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input, context) => {
      const result = await search.search({
        query: input.query,
        index: input.index,
        mode: input.mode,
        pageSize: input.pageSize,
        actor: { id: context.user.id, permissions: context.user.permissions },
      });
      return {
        provider: result.provider,
        mode: result.mode,
        hits: result.hits.map((hit) => ({
          index: hit.index,
          documentId: hit.documentId,
          title: hit.title,
          snippet: hit.snippet,
          score: hit.score,
        })),
        meta: result.meta,
      };
    },
  });
}

function queryAnalyticsTool(analytics: AnalyticsService) {
  return defineCopilotTool({
    name: 'queryAnalytics',
    description:
      'Query a registered analytics KPI as a snapshot, time series, or breakdown. Not a warehouse and not problem-specific metrics unless registered.',
    requiredPermission: PERMISSIONS.ANALYTICS_READ,
    riskLevel: 'low',
    inputSchema: z.object({
      kpi: z.string().trim().min(1).max(64),
      kind: z.enum(['snapshot', 'timeseries', 'breakdown']).optional(),
      groupBy: z.string().trim().min(1).max(64).optional(),
      granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
    }),
    handler: async (input, context) => {
      const result = await analytics.query({
        kpi: input.kpi,
        kind: input.kind,
        groupBy: input.groupBy,
        granularity: input.granularity,
        actor: { id: context.user.id, permissions: context.user.permissions },
      });
      return {
        provider: result.provider,
        kind: result.kind,
        kpi: result.kpi,
        aggregation: result.aggregation,
        snapshot: result.snapshot,
        points: result.points?.slice(0, 20),
        rows: result.rows?.slice(0, 20),
        meta: result.meta,
      };
    },
  });
}
