import { AUDIT_ACTIONS } from '../constants';
import { FeatureDisabledError } from '../errors';
import { isFeatureEnabled } from '../features';
import { PLATFORM_VERSION } from '../capabilities';
import { parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import type { ProjectConfiguration } from '../project-planning';
import { generateProject } from './engine';
import { projectGeneratorBodySchema } from './schemas';
import {
  defaultOutputRoot,
  findKitRoot,
  writeGeneratedProject,
} from './writer';
import type { WriteGeneratedProjectResult } from './types';

export function isProjectGeneratorEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'projectGenerator');
}

export interface ProjectGeneratorServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  audit?: AuditService | null;
  kitRoot?: string;
}

export class ProjectGeneratorService {
  constructor(private readonly options: ProjectGeneratorServiceOptions) {}

  get enabled(): boolean {
    return isProjectGeneratorEnabled(this.options.config);
  }

  async preview(input: Record<string, unknown> & { userId?: string }): Promise<WriteGeneratedProjectResult> {
    return this.run(input, true);
  }

  async generate(input: Record<string, unknown> & { userId?: string }): Promise<WriteGeneratedProjectResult> {
    return this.run(input, input.dryRun === true);
  }

  private async run(
    input: Record<string, unknown> & { userId?: string },
    dryRun: boolean,
  ): Promise<WriteGeneratedProjectResult> {
    this.assertReady();
    const parsed = parseWithSchema(
      projectGeneratorBodySchema,
      {
        configuration: input.configuration,
        dryRun: input.dryRun,
        overwrite: input.overwrite,
      },
      {
        source: 'body',
        message: 'Invalid project generator request',
      },
    );
    const result = generateProject({
      configuration: parsed.configuration as ProjectConfiguration,
    });
    const kitRoot = this.options.kitRoot ?? (await findKitRoot());
    const written = await writeGeneratedProject(result, {
      kitRoot,
      outputRoot: defaultOutputRoot(kitRoot, result.identifiers.slug),
      overwrite: parsed.overwrite !== false,
      dryRun,
    });

    await this.audit(dryRun ? 'preview' : 'generate', {
      userId: input.userId,
      configurationId: result.rebuilt.id,
      digest: result.contentDigest,
      configurationDigest: result.configurationDigest,
      fileCount: written.files.length,
      problemModule: result.identifiers.moduleId,
      architectureMode: result.rebuilt.resolved.architectureMode,
      deploymentMode: result.rebuilt.resolved.deploymentMode,
      relativeRoot: written.relativeRoot,
      dryRun,
    });

    return written;
  }

  private async audit(kind: 'preview' | 'generate', request: Record<string, unknown>): Promise<void> {
    try {
      await this.options.audit?.record({
        action:
          kind === 'generate' ? AUDIT_ACTIONS.PROJECT_GENERATOR_GENERATED : AUDIT_ACTIONS.PROJECT_GENERATOR_PREVIEWED,
        resource: 'project.generator',
        status: 'success',
        userId: typeof request.userId === 'string' ? request.userId : undefined,
        request: {
          ...Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'userId')),
          catalogVersion: PLATFORM_VERSION,
        },
      });
    } catch (error) {
      this.options.logger.warn({ err: error }, 'Project generator audit failed');
    }
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('projectGenerator');
    }
  }
}

export function createProjectGeneratorService(
  options: ProjectGeneratorServiceOptions,
): ProjectGeneratorService {
  return new ProjectGeneratorService(options);
}
