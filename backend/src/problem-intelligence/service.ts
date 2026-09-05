import { AUDIT_ACTIONS, PROBLEM_INTELLIGENCE } from '../constants';
import { ExternalServiceError, FeatureDisabledError } from '../errors';
import { isFeatureEnabled } from '../features';
import type { CapabilityRegistry } from '../capabilities';
import { PLATFORM_VERSION, uniqueSortedNames } from '../capabilities';
import type { AIService } from '../integrations/ai';
import { applyConfidenceReview, isLowConfidence } from '../integrations/ai/ai.review';
import {
  containsExecutablePayload,
  detectPromptInjection,
  redactSensitiveText,
  redactSensitiveValue,
} from '../integrations/ai/guardrails';
import { parseAiOutput, parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import {
  classifyMappings,
  collectExistingCapabilities,
  collectNewProblemLogic,
  toUnknownableList,
} from './classify';
import { buildProblemIntelligencePrompt } from './prompt';
import { problemIntelligenceAnalyzeBodySchema, problemIntelligenceDraftSchema } from './schemas';
import type {
  ProblemIntelligenceAnalyzeInput,
  ProblemIntelligenceDraft,
  ProblemIntelligenceResult,
} from './types';

export function isProblemIntelligenceEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'problemIntelligence');
}

export interface ProblemIntelligenceServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  ai: AIService;
  capabilities: CapabilityRegistry;
  audit?: AuditService | null;
}

export class ProblemIntelligenceService {
  constructor(private readonly options: ProblemIntelligenceServiceOptions) {}

  get enabled(): boolean {
    return isProblemIntelligenceEnabled(this.options.config);
  }

  async analyze(input: ProblemIntelligenceAnalyzeInput): Promise<ProblemIntelligenceResult> {
    this.assertReady();

    const parsed = parseWithSchema(problemIntelligenceAnalyzeBodySchema, input, {
      source: 'body',
      message: 'Invalid problem statement analysis request',
    });
    const statement = redactSensitiveText(parsed.statement).slice(
      0,
      PROBLEM_INTELLIGENCE.MAX_STATEMENT_CHARS,
    );
    const injection = detectPromptInjection(statement);
    const capabilityNames = uniqueSortedNames(this.options.capabilities.names());
    const prompt = buildProblemIntelligencePrompt({
      statement,
      title: parsed.title,
      capabilityNames,
    });

    const generated = await this.options.ai.generateStructured({
      system: prompt.system,
      prompt: prompt.prompt,
      schema: problemIntelligenceDraftSchema,
      schemaName: 'problemSpec',
      temperature: 0.1,
    });

    const draft = parseAiOutput(problemIntelligenceDraftSchema, generated.data);
    const classified = classifyMappings(draft.mappings, this.options.capabilities);
    const review = applyConfidenceReview({
      confidence: draft.confidence,
      requiresReview: draft.requiresReview,
    });

    const uncertainty = uniqueNotes([
      ...draft.uncertainty,
      ...classified.uncertainty,
      ...undeterminedSectionNotes(draft),
    ]);
    const executable =
      containsExecutablePayload(draft) || containsExecutablePayload(generated.rawText);
    if (executable) {
      uncertainty.push(
        'Model output contained executable-looking content. It was not executed, applied to a repository, or sent to SQL/Odoo/HTTP/filesystem.',
      );
    }
    if (injection.suspicious) {
      uncertainty.push(
        'Prompt-injection signals were detected in the statement. Fenced text was treated as data, not instructions.',
      );
    }

    const requiresReview =
      review.requiresReview ||
      executable ||
      injection.suspicious ||
      isLowConfidence(review.confidence) ||
      classified.mappings.some((mapping) => mapping.classification === 'unknown');

    const confidence = injection.suspicious
      ? Math.min(review.confidence, 0.45)
      : review.confidence;

    const result: ProblemIntelligenceResult = {
      title: parsed.title ?? null,
      spec: {
        problemSummary: draft.problemSummary,
        users: toUnknownableList(draft.users),
        actors: toUnknownableList(draft.actors),
        workflows: toUnknownableList(draft.workflows),
        entities: toUnknownableList(draft.entities),
        businessRules: toUnknownableList(draft.businessRules),
        integrations: toUnknownableList(draft.integrations),
        odooRequirements: toUnknownableList(draft.odooRequirements),
        aiRequirements: toUnknownableList(draft.aiRequirements),
        automationRequirements: toUnknownableList(draft.automationRequirements),
        notifications: toUnknownableList(draft.notifications),
        documents: toUnknownableList(draft.documents),
        reports: toUnknownableList(draft.reports),
        securityRequirements: toUnknownableList(draft.securityRequirements),
        nonFunctionalRequirements: toUnknownableList(draft.nonFunctionalRequirements),
        likelyDataRequirements: toUnknownableList(draft.likelyDataRequirements),
        likelyInfrastructureRequirements: toUnknownableList(draft.likelyInfrastructureRequirements),
      },
      mappings: classified.mappings,
      existingCapabilities: collectExistingCapabilities(classified.mappings),
      newProblemLogic: collectNewProblemLogic(classified.mappings),
      unknowns: uniqueNotes(draft.unknowns),
      uncertainty,
      confidence,
      requiresReview,
      injection,
      catalogVersion: PLATFORM_VERSION,
      promptVersion: prompt.version,
      model: generated.model,
      provider: generated.provider,
    };

    await this.auditAnalysis({
      userId: input.userId,
      confidence: result.confidence,
      requiresReview: result.requiresReview,
      injection: result.injection.suspicious,
      mappingCount: result.mappings.length,
      hallucinated: result.mappings.filter((mapping) => mapping.hallucinatedCapability).length,
    });

    return result;
  }

  private async auditAnalysis(request: Record<string, unknown>): Promise<void> {
    try {
      await this.options.audit?.record({
        action: AUDIT_ACTIONS.PROBLEM_INTELLIGENCE_ANALYZED,
        resource: 'problem.intelligence',
        status: 'success',
        userId: typeof request.userId === 'string' ? request.userId : undefined,
        request: redactSensitiveValue({
          confidence: request.confidence,
          requiresReview: request.requiresReview,
          injection: request.injection,
          mappingCount: request.mappingCount,
          hallucinated: request.hallucinated,
        }),
      });
    } catch (error) {
      this.options.logger.warn({ err: error }, 'Problem intelligence audit failed');
    }
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('problemIntelligence');
    }

    if (!this.options.ai.ready) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }
  }
}

export function createProblemIntelligenceService(
  options: ProblemIntelligenceServiceOptions,
): ProblemIntelligenceService {
  return new ProblemIntelligenceService(options);
}

function uniqueNotes(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function undeterminedSectionNotes(draft: ProblemIntelligenceDraft): string[] {
  const notes: string[] = [];
  const sections: Array<[string, unknown]> = [
    ['users', draft.users],
    ['actors', draft.actors],
    ['workflows', draft.workflows],
    ['entities', draft.entities],
    ['business rules', draft.businessRules],
    ['integrations', draft.integrations],
    ['Odoo requirements', draft.odooRequirements],
    ['AI requirements', draft.aiRequirements],
    ['automation requirements', draft.automationRequirements],
    ['notifications', draft.notifications],
    ['documents', draft.documents],
    ['reports', draft.reports],
    ['security requirements', draft.securityRequirements],
    ['non-functional requirements', draft.nonFunctionalRequirements],
    ['data requirements', draft.likelyDataRequirements],
    ['infrastructure requirements', draft.likelyInfrastructureRequirements],
  ];

  for (const [label, value] of sections) {
    if (value === 'unknown') {
      notes.push(`${label} could not be determined from the statement.`);
    }
  }

  if (draft.problemSummary === 'unknown') {
    notes.push('Problem summary could not be determined from the statement.');
  }

  return notes;
}
