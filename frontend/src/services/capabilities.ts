import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export interface CatalogCapability {
  name: string;
  kind: string;
  category: string;
  maturity: string;
  summary: string;
  dependencies: string[];
  optionalDependencies: string[];
  conflicts: string[];
  featureFlag?: string;
  enabled?: boolean;
}

export interface CatalogProfile {
  name: string;
  title: string;
  summary: string;
  maturity: string;
  capabilities: string[];
  optionalCapabilities?: string[];
}

export interface CapabilitiesSnapshot {
  architecture: string;
  platformVersion: string;
  capabilities: CatalogCapability[];
  profiles: CatalogProfile[];
}

export function getCapabilities(): Promise<CapabilitiesSnapshot> {
  return apiRequest<CapabilitiesSnapshot>(API_PATHS.capabilities);
}
