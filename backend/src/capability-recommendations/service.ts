import { AUDIT_ACTIONS } from '../constants';
import { FeatureDisabledError } from '../errors';
import { isFeatureEnabled } from '../features';
import { PLATFORM_VERSION } from '../capabilities';
import { parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import { recommendCapabilities } from './engine';
import { capabilityRecommendBodySchema } from './schemas';
import type {
  CapabilityRecommendRequest,
  CapabilityRecommendationInput,
  CapabilityRecommendationResult,
} from './types';

export function isCapabilityRecommendationsEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'capabilityRecommendations');
}

export interface CapabilityRecommendationServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  audit?: AuditService | null;
}

export class CapabilityRecommendationService {
  constructor(private readonly options: CapabilityRecommendationServiceOptions) {}

  get enabled(): boolean {
    return isCapabilityRecommendationsEnabled(this.options.config);
  }

  async recommend(input: CapabilityRecommendRequest): Promise<CapabilityRecommendationResult> {
    this.assertReady();

    const parsed = parseWithSchema(capabilityRecommendBodySchema, input, {
      source: 'body',
      message: 'Invalid capability recommendation request',
    });
    const result = recommendCapabilities(parsed.analysis as CapabilityRecommendationInput);

    await this.auditRecommendation({
      userId: input.userId,
      title: parsed.title ?? null,
      confidence: result.confidence,
      architectureMode: result.selected.architectureMode,
      deploymentMode: result.selected.deploymentMode,
      profileCount: result.selected.profiles.length,
      capabilityCount: result.selected.capabilities.length,
      rejectedCount: result.rejected.length,
      resolverValid: result.resolution.valid,
    });

    return result;
  }

  private async auditRecommendation(request: Record<string, unknown>): Promise<void> {
    try {
      await this.options.audit?.record({
        action: AUDIT_ACTIONS.CAPABILITY_RECOMMENDATIONS_GENERATED,
        resource: 'capability.recommendations',
        status: 'success',
        userId: typeof request.userId === 'string' ? request.userId : undefined,
        request: {
          confidence: request.confidence,
          title: request.title,
          architectureMode: request.architectureMode,
          deploymentMode: request.deploymentMode,
          profileCount: request.profileCount,
          capabilityCount: request.capabilityCount,
          rejectedCount: request.rejectedCount,
          resolverValid: request.resolverValid,
          catalogVersion: PLATFORM_VERSION,
        },
      });
    } catch (error) {
      this.options.logger.warn({ err: error }, 'Capability recommendation audit failed');
    }
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('capabilityRecommendations');
    }
  }
}

export function createCapabilityRecommendationService(
  options: CapabilityRecommendationServiceOptions,
): CapabilityRecommendationService {
  return new CapabilityRecommendationService(options);
}
