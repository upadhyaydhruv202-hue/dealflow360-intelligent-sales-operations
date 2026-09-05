import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';
import type { ProjectConfiguration } from './project-planning';

export interface GeneratedFileRecord {
  path: string;
  role: string;
  sha256: string;
  bytes: number;
  status: 'written' | 'unchanged' | 'preview';
}

export interface ProjectGenerationResult {
  outputRoot: string;
  relativeRoot: string;
  dryRun: boolean;
  files: GeneratedFileRecord[];
  contentDigest: string;
  configurationDigest: string;
  generationManifest: {
    platformVersion: string;
    generatedAt: string;
    problemModule: string;
    architectureMode: string;
    deploymentMode: string;
    contentDigest: string;
    fileCount: number;
  };
}

export function previewProjectGeneration(
  configuration: ProjectConfiguration,
  token: string,
): Promise<ProjectGenerationResult> {
  return apiRequest<ProjectGenerationResult>(API_PATHS.projectGenerator.preview, {
    method: 'POST',
    token,
    body: { configuration },
  });
}

export function generateProjectOverlay(
  configuration: ProjectConfiguration,
  token: string,
): Promise<ProjectGenerationResult> {
  return apiRequest<ProjectGenerationResult>(API_PATHS.projectGenerator.generate, {
    method: 'POST',
    token,
    body: { configuration },
  });
}
