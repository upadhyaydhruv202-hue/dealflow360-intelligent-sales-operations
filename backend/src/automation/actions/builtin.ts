import { z } from 'zod';

import { AUTOMATION } from '../../constants';
import { AuthorizationError, ExternalServiceError, ValidationError } from '../../errors';
import type { AIService } from '../../integrations/ai';
import { EMAIL_TEMPLATE_IDS, type EmailService, type EmailTemplateId } from '../../integrations/email';
import type { OdooService } from '../../integrations/odoo';
import type { PdfService } from '../../integrations/pdf';
import type { JobQueue } from '../../jobs/queue';
import { PERMISSIONS } from '../../rbac/catalog';
import { emailSchema, urlSchema } from '../../schemas/common';
import { fetchExternal, assertSafeExternalUrl } from '../../security';
import type { NotificationService } from '../../notifications';
import type { AuditService } from '../../audit/audit.service';
import { interpolateTemplate, readPayloadPath } from '../automation.conditions';
import type { AllowedJobRegistry, AutomationActionRegistry, RecordUpdaterRegistry } from '../automation.registry';
import { defineAutomationAction } from '../automation.types';

const ODOO_WRITE_METHODS = new Set(['create', 'write', 'unlink']);

const EMAIL_TEMPLATES: Record<string, { subject: string; text: string }> = {
  'invoice-reminder': {
    subject: 'Invoice reminder',
    text: 'An invoice is overdue by {{daysOverdue}} days.',
  },
  generic: {
    subject: '{{subject}}',
    text: '{{body}}',
  },
};

export interface BuiltinAutomationActionDeps {
  email?: EmailService | null;
  notifications?: NotificationService | null;
  pdf?: PdfService | null;
  ai?: AIService | null;
  odoo?: OdooService | null;
  jobs?: JobQueue | null;
  audit?: AuditService | null;
  recordUpdaters: RecordUpdaterRegistry;
  allowedJobs: AllowedJobRegistry;
  fetchImpl?: typeof fetch;
}

export function registerBuiltinActions(
  registry: AutomationActionRegistry,
  deps: BuiltinAutomationActionDeps,
): void {
  registry.register(sendEmailAction(deps));
  registry.register(sendNotificationAction(deps));
  registry.register(generatePdfAction(deps));
  registry.register(queueAiAnalysisAction(deps));
  registry.register(callOdooAction(deps));
  registry.register(createAuditLogAction(deps));
  registry.register(enqueueJobAction(deps));
  registry.register(webhookAction(deps));
  registry.register(updateRecordAction(deps));
}

function sendEmailAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'sendEmail',
    description: 'Send a transactional email through EmailService. Templates are interpolated from the event payload.',
    requiredPermission: PERMISSIONS.NOTIFICATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('sendEmail'),
      template: z.string().trim().min(1).max(64).optional(),
      to: z.union([emailSchema, z.array(emailSchema).min(1).max(20)]).optional(),
      toField: z.string().trim().min(1).max(128).optional(),
      subject: z.string().trim().min(1).max(200).optional(),
      text: z.string().trim().min(1).max(20_000).optional(),
    }),
    handler: async (input, context) => {
      if (!deps.email) {
        throw new ExternalServiceError('Email is not configured', { provider: 'email' });
      }
      const to = resolveRecipient(input.to, input.toField, context.event.payload);
      const templateId = input.template;
      if (templateId && isEmailTemplateId(templateId)) {
        return deps.email.send({
          to,
          template: templateId,
          variables: templateVariables(context.event.payload),
          subject: input.subject,
          text: input.text,
          idempotencyKey: `${context.execution.id}:sendEmail`,
        });
      }
      const template = EMAIL_TEMPLATES[templateId ?? 'generic'] ?? EMAIL_TEMPLATES.generic;
      const subject = interpolateTemplate(input.subject ?? template.subject, context.event.payload);
      const text = interpolateTemplate(input.text ?? template.text, context.event.payload);
      return deps.email.send({
        to,
        subject: subject || 'Notification',
        text: text || 'A workflow event occurred.',
        idempotencyKey: `${context.execution.id}:sendEmail`,
      });
    },
  });
}

function sendNotificationAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'sendNotification',
    description: 'Create an in-app notification for a user id or a payload field.',
    requiredPermission: PERMISSIONS.NOTIFICATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('sendNotification'),
      userId: z.string().uuid().optional(),
      userIdField: z.string().trim().min(1).max(128).optional(),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(4000),
      notificationType: z.enum(['info', 'success', 'warning', 'error']).optional(),
    }),
    handler: async (input, context) => {
      if (!deps.notifications) {
        throw new ExternalServiceError('Notifications are not configured', { provider: 'notifications' });
      }
      const userId = resolveUserId(input.userId, input.userIdField, context);
      return deps.notifications.notify({
        userId,
        type: input.notificationType ?? 'info',
        title: interpolateTemplate(input.title, context.event.payload),
        body: interpolateTemplate(input.body, context.event.payload),
      });
    },
  });
}

function generatePdfAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'generatePDF',
    description: 'Generate a PDF through PdfService and store it.',
    requiredPermission: PERMISSIONS.REPORTS_GENERATE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('generatePDF'),
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
    handler: async (input, context) => {
      if (!deps.pdf) {
        throw new ExternalServiceError('PDF generation is not configured', { provider: 'pdf' });
      }
      return deps.pdf.generate({
        title: interpolateTemplate(input.title, context.event.payload),
        sections: input.sections?.map((section) => ({
          heading: section.heading ? interpolateTemplate(section.heading, context.event.payload) : undefined,
          lines: section.lines.map((line) => interpolateTemplate(line, context.event.payload)),
        })),
        filename: input.filename,
      });
    },
  });
}

function queueAiAnalysisAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'queueAIAnalysis',
    description: 'Run schema-validated AI analysis on event content. AI output is never executed.',
    requiredPermission: PERMISSIONS.AI_USE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('queueAIAnalysis'),
      content: z.string().trim().min(1).max(20_000).optional(),
      contentField: z.string().trim().min(1).max(128).optional(),
      focus: z.enum(['general', 'risk']).optional(),
    }),
    handler: async (input, context) => {
      if (!deps.ai) {
        throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
      }
      const content = resolveContent(input.content, input.contentField, context.event.payload);
      if (deps.jobs && deps.ai.enqueueAnalyze) {
        const jobId = await deps.ai.enqueueAnalyze(
          { content, focus: input.focus ?? 'general' },
          { jobId: `ai.analyze:${context.execution.id}` },
        );
        return { queued: true, jobId, jobName: 'ai.analyze' };
      }
      const result = await deps.ai.analyze({ content, focus: input.focus ?? 'general' });
      return {
        summary: result.data.summary,
        findings: result.data.findings,
        confidence: result.data.confidence,
        model: result.model,
      };
    },
  });
}

function callOdooAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'callOdoo',
    description: 'Call an allowlisted Odoo capability. Arbitrary models and methods are rejected.',
    requiredPermission: PERMISSIONS.ODOO_READ,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('callOdoo'),
      capability: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-z][a-z0-9._-]*$/),
      method: z
        .enum(['search', 'search_read', 'read', 'search_count', 'create', 'write', 'unlink'])
        .default('search_read'),
      params: z.record(z.string().min(1).max(64), z.unknown()).optional(),
      confirmed: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      if (!deps.odoo?.enabled) {
        throw new ExternalServiceError('Odoo is not enabled', { provider: 'odoo' });
      }
      const method = input.method ?? 'search_read';
      if (ODOO_WRITE_METHODS.has(method) && !context.rule.allowDestructive) {
        throw new ValidationError('Odoo writes require explicit destructive policy', [
          { path: 'allowDestructive', message: 'Set allowDestructive to true for Odoo write methods', code: 'custom' },
        ]);
      }
      const permission = ODOO_WRITE_METHODS.has(method) ? PERMISSIONS.ODOO_WRITE : PERMISSIONS.ODOO_READ;
      if (context.actor) {
        const owned = new Set(context.actor.permissions);
        if (!owned.has(permission)) {
          throw new AuthorizationError('The event actor is not allowed to call this Odoo method', {
            requiredPermissions: [permission],
          });
        }
      } else if (ODOO_WRITE_METHODS.has(method) && input.confirmed !== true) {
        throw new ValidationError('Actorless Odoo writes require confirmed: true on the action', [
          {
            path: 'confirmed',
            message: 'Set confirmed to true on callOdoo write actions used by scheduled or system events',
            code: 'custom',
          },
        ]);
      }
      return deps.odoo.execute({
        user: context.actor,
        internal: !context.actor,
        capability: input.capability,
        method,
        params: input.params,
        confirmed: input.confirmed === true,
      });
    },
  });
}

function createAuditLogAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'createAuditLog',
    description: 'Write a sanitized audit event for this automation run.',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('createAuditLog'),
      action: z.string().trim().min(1).max(128),
      resource: z.string().trim().min(1).max(64).optional(),
      status: z.string().trim().min(1).max(64).optional(),
    }),
    handler: async (input, context) => {
      if (!deps.audit) {
        throw new ExternalServiceError('Audit logging is not configured', { provider: 'audit' });
      }
      await deps.audit.record({
        userId: context.actor?.id,
        action: input.action,
        resource: input.resource ?? 'automation',
        status: input.status ?? 'succeeded',
        request: {
          ruleId: context.rule.id,
          executionId: context.execution.id,
          trigger: context.event.type,
          eventId: context.event.id,
        },
      });
      return { recorded: true };
    },
  });
}

function enqueueJobAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'enqueueJob',
    description: 'Enqueue an allowlisted background job. Arbitrary job names are rejected.',
    requiredPermission: PERMISSIONS.AUTOMATIONS_EXECUTE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('enqueueJob'),
      jobName: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-z][a-z0-9._-]*$/),
      payload: z.record(z.string(), z.unknown()).optional(),
    }),
    handler: async (input, context) => {
      if (!deps.jobs) {
        throw new ExternalServiceError('Job queue is not configured', { provider: 'jobs' });
      }
      if (!deps.allowedJobs.has(input.jobName)) {
        throw new ValidationError('Job name is not allowlisted', [
          { path: 'jobName', message: `Job "${input.jobName}" is not registered for automation`, code: 'custom' },
        ]);
      }
      const jobId = await deps.jobs.enqueue(input.jobName, {
        ...(input.payload ?? {}),
        automationExecutionId: context.execution.id,
      });
      return { jobId, jobName: input.jobName };
    },
  });
}

function webhookAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'webhook',
    description: 'POST JSON to an allowlisted HTTPS URL. Private hosts are blocked. Demo mode does not send.',
    requiredPermission: PERMISSIONS.AUTOMATIONS_EXECUTE,
    destructive: true,
    inputSchema: z.object({
      type: z.literal('webhook'),
      url: urlSchema,
      method: z.enum(['POST']).default('POST'),
      headers: z.record(z.string().min(1).max(64), z.string().max(256)).optional(),
      body: z.record(z.string(), z.unknown()).optional(),
    }),
    handler: async (input, context) => {
      assertSafeExternalUrl(input.url, { field: 'url' });
      if (context.demoMode) {
        return { delivered: false, mocked: true, url: input.url };
      }
      try {
        const response = await fetchExternal(input.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(input.headers ?? {}),
          },
          body: JSON.stringify(input.body ?? context.event.payload),
          timeoutMs: AUTOMATION.WEBHOOK_TIMEOUT_MS,
          fetchImpl: deps.fetchImpl,
          field: 'url',
        });
        if (!response.ok) {
          throw new ExternalServiceError('Webhook delivery failed', {
            provider: 'webhook',
            status: response.status,
          });
        }
        return { delivered: true, status: response.status };
      } catch (error) {
        if (error instanceof ExternalServiceError || error instanceof ValidationError) {
          throw error;
        }
        throw new ExternalServiceError('Webhook delivery failed', { provider: 'webhook' });
      }
    },
  });
}

function updateRecordAction(deps: BuiltinAutomationActionDeps) {
  return defineAutomationAction({
    type: 'updateRecord',
    description: 'Update a registered resource through an allowlisted updater. Unknown resources are rejected.',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: true,
    inputSchema: z.object({
      type: z.literal('updateRecord'),
      resource: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-z][a-z0-9._-]*$/),
      id: z.string().trim().min(1).max(64),
      data: z.record(z.string().min(1).max(64), z.unknown()),
    }),
    handler: async (input, context) => {
      const updater = deps.recordUpdaters.get(input.resource);
      if (!updater) {
        throw new ValidationError('No updater is registered for this resource', [
          { path: 'resource', message: `Resource "${input.resource}" is not registered`, code: 'custom' },
        ]);
      }
      return updater.handler({ id: input.id, data: input.data }, context);
    },
  });
}

function isEmailTemplateId(value: string): value is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

function templateVariables(payload: Record<string, unknown>): Record<string, string | number | boolean> {
  const variables: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      variables[key] = value;
    }
  }
  return variables;
}

function resolveRecipient(
  to: string | string[] | undefined,
  toField: string | undefined,
  payload: Record<string, unknown>,
): string | string[] {
  if (to) {
    return to;
  }
  const fromField = toField ? readPayloadPath(payload, toField) : readPayloadPath(payload, 'email');
  if (typeof fromField === 'string') {
    return fromField;
  }
  throw new ValidationError('Email recipient is missing', [
    { path: 'to', message: 'Provide to, toField, or payload.email', code: 'custom' },
  ]);
}

function resolveUserId(
  userId: string | undefined,
  userIdField: string | undefined,
  context: { event: { payload: Record<string, unknown>; actor?: { id: string } }; actor?: { id: string } },
): string {
  if (userId) {
    return userId;
  }
  if (userIdField) {
    const value = readPayloadPath(context.event.payload, userIdField);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  const fromPayload = readPayloadPath(context.event.payload, 'userId');
  if (typeof fromPayload === 'string' && fromPayload.length > 0) {
    return fromPayload;
  }
  if (context.actor?.id) {
    return context.actor.id;
  }
  throw new ValidationError('Notification user id is missing', [
    { path: 'userId', message: 'Provide userId, userIdField, payload.userId, or an event actor', code: 'custom' },
  ]);
}

function resolveContent(
  content: string | undefined,
  contentField: string | undefined,
  payload: Record<string, unknown>,
): string {
  if (content) {
    return interpolateTemplate(content, payload);
  }
  if (contentField) {
    const value = readPayloadPath(payload, contentField);
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  const fallback = readPayloadPath(payload, 'content');
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback;
  }
  return JSON.stringify(payload);
}
