import { APPLICATION_CAPABILITIES } from './application';
import { ADAPTER_CAPABILITIES } from './adapters';
import { FRONTEND_CAPABILITIES } from './frontend';
import { INFRASTRUCTURE_CAPABILITIES } from './infrastructure';
import { MODE_CAPABILITIES } from './modes';
import type { CapabilityDefinition } from '../types';

export const PLATFORM_CAPABILITIES: readonly CapabilityDefinition[] = [
  ...APPLICATION_CAPABILITIES,
  ...FRONTEND_CAPABILITIES,
  ...INFRASTRUCTURE_CAPABILITIES,
  ...ADAPTER_CAPABILITIES,
  ...MODE_CAPABILITIES,
];

export function listPlatformCapabilities(): CapabilityDefinition[] {
  return [...PLATFORM_CAPABILITIES];
}
