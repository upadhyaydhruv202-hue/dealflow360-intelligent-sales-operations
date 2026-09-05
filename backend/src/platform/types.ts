import type { CapabilityDefinition, CapabilityRegistry } from '../capabilities';
import type { AutomationRegistries } from '../automation';
import type { CopilotToolRegistry } from '../copilot';
import type { EventBus } from '../events';
import type { OdooCapabilityRegistry } from '../integrations/odoo';
import type { ReportRegistry } from '../integrations/reports';
import type { IntentRegistry } from '../intents';
import type { JobQueue } from '../jobs';
import type { Scheduler } from '../scheduler';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';

export type PlatformRole = 'api' | 'worker';

export interface PlatformPlugin {
  readonly name: string;
  /** Semver. Defaults to PLUGIN_VERSION when omitted. */
  readonly version?: string;
  /** Static capability metadata. Discoverable without calling register() or constructing services. */
  readonly capabilities?: readonly CapabilityDefinition[];
  register?(ctx: PlatformPluginContext): void;
}

export interface PlatformRegistries {
  readonly copilot: CopilotToolRegistry | null;
  readonly intents: IntentRegistry | null;
  readonly odooCapabilities: OdooCapabilityRegistry | null;
  readonly automation: AutomationRegistries | null;
  readonly reports: ReportRegistry | null;
}

export interface PlatformPluginContext {
  readonly role: PlatformRole;
  readonly config: AppConfig;
  readonly logger: AppLogger;
  readonly jobs: JobQueue;
  readonly events: EventBus;
  readonly scheduler: Scheduler | null;
  readonly registries: PlatformRegistries;
  readonly capabilities: CapabilityRegistry;
}

export interface ApplyPlatformPluginsOptions {
  plugins?: readonly PlatformPlugin[];
  role: PlatformRole;
  config: AppConfig;
  logger: AppLogger;
  jobs: JobQueue;
  events: EventBus;
  scheduler?: Scheduler | null;
  registries: PlatformRegistries;
  capabilities: CapabilityRegistry;
}
