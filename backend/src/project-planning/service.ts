import { AUDIT_ACTIONS } from '../constants';
import { FeatureDisabledError } from '../errors';
import { isFeatureEnabled } from '../features';
import { PLATFORM_VERSION } from '../capabilities';
import { parseWithSchema } from '../schemas/parse';
import { recommendCapabilities } from '../capability-recommendations';
import type { CapabilityRecommendationInput } from '../capability-recommendations';
import type { ProblemIntelligenceService } from '../problem-intelligence';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import { buildProjectConfiguration } from './engine';
import {
  projectPlanningAnalyzeBodySchema,
  projectPlanningSelectionBodySchema,
} from './schemas';
import type { ProjectConfiguration, ProjectPlanningAnalyzeResult } from './types';

export function isProjectPlanningEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'projectPlanning');
}

export interface ProjectPlanningServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  audit?: AuditService | null;
  problemIntelligence?: ProblemIntelligenceService | null;
}

export class ProjectPlanningService {
  constructor(private readonly options: ProjectPlanningServiceOptions) {}

  get enabled(): boolean {
    return isProjectPlanningEnabled(this.options.config);
  }

  async analyze(input: {
    statement: string;
    title?: string;
    userId?: string;
  }): Promise<ProjectPlanningAnalyzeResult> {
    this.assertReady();
    const parsed = parseWithSchema(projectPlanningAnalyzeBodySchema, input, {
      source: 'body',
      message: 'Invalid project planning analyze request',
    });

    let analysis: Awaited<ReturnType<ProblemIntelligenceService['analyze']>> | null = null;
    if (this.options.problemIntelligence) {
      analysis = await this.options.problemIntelligence.analyze({
        statement: parsed.statement,
        title: parsed.title,
        userId: input.userId,
      });
    }

    const recommendationInput: CapabilityRecommendationInput = analysis ?? {
      problemSummary: parsed.statement,
      mappings: [],
    };
    const recommendations = recommendCapabilities(recommendationInput);
    const configuration = buildProjectConfiguration(
      {
        title: parsed.title ?? analysis?.title ?? undefined,
        statement: parsed.statement,
        analysis: recommendationInput,
        capabilities: [
          ...recommendations.selected.capabilities,
          ...recommendations.selected.adapters,
          ...recommendations.selected.infrastructure,
        ],
        profiles: recommendations.selected.profiles,
        architectureMode: recommendations.selected.architectureMode,
        deploymentMode: recommendations.selected.deploymentMode,
      },
      {
        intent: 'validate',
        userId: input.userId,
        recommendations,
        featureConfig: this.options.config,
      },
    );

    await this.audit('analyze', {
      userId: input.userId,
      title: parsed.title ?? null,
      hasAnalysis: Boolean(analysis),
      requirementCount: configuration.requirements.length,
      capabilityCount: configuration.resolved.capabilities.length,
      architectureMode: configuration.resolved.architectureMode,
      deploymentMode: configuration.resolved.deploymentMode,
      valid: configuration.validation.valid,
    });

    return { analysis, recommendations, configuration };
  }

  async validate(
    input: Record<string, unknown> & { userId?: string },
  ): Promise<ProjectConfiguration> {
    this.assertReady();
    return this.build(input, 'validate');
  }

  async approve(
    input: Record<string, unknown> & { userId?: string },
  ): Promise<ProjectConfiguration> {
    this.assertReady();
    return this.build(input, 'approve');
  }

  private async build(
    input: Record<string, unknown> & { userId?: string },
    intent: 'validate' | 'approve',
  ): Promise<ProjectConfiguration> {
    const parsed = parseWithSchema(projectPlanningSelectionBodySchema, input, {
      source: 'body',
      message: 'Invalid project planning selection',
    });
    const configuration = buildProjectConfiguration(
      {
        title: parsed.title,
        statement: parsed.statement,
        analysis: parsed.analysis as CapabilityRecommendationInput | undefined,
        capabilities: parsed.capabilities,
        profiles: parsed.profiles,
        architectureMode: parsed.architectureMode,
        deploymentMode: parsed.deploymentMode,
        includeOptional: parsed.includeOptional,
        closeDependencies: parsed.closeDependencies,
      },
      {
        intent,
        userId: input.userId,
        featureConfig: this.options.config,
      },
    );

    if (intent === 'approve') {
      await this.audit('approve', {
        userId: input.userId,
        configurationId: configuration.id,
        title: parsed.title ?? null,
        architectureMode: configuration.resolved.architectureMode,
        deploymentMode: configuration.resolved.deploymentMode,
        profileCount: configuration.resolved.profiles.length,
        capabilityCount: configuration.resolved.capabilities.length,
        valid: configuration.validation.valid,
        digest: configuration.integrity.digest,
      });
    }

    return configuration;
  }

  private async audit(kind: 'analyze' | 'approve', request: Record<string, unknown>): Promise<void> {
    try {
      await this.options.audit?.record({
        action:
          kind === 'approve' ? AUDIT_ACTIONS.PROJECT_PLANNING_APPROVED : AUDIT_ACTIONS.PROJECT_PLANNING_ANALYZED,
        resource: 'project.planning',
        status: 'success',
        userId: typeof request.userId === 'string' ? request.userId : undefined,
        request: {
          ...Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'userId')),
          catalogVersion: PLATFORM_VERSION,
        },
      });
    } catch (error) {
      this.options.logger.warn({ err: error }, 'Project planning audit failed');
    }
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('projectPlanning');
    }
  }
}

export function createProjectPlanningService(
  options: ProjectPlanningServiceOptions,
): ProjectPlanningService {
  return new ProjectPlanningService(options);
}
