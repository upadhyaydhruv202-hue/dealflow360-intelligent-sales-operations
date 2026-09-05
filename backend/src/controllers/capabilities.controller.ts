import type { Request, Response } from 'express';

import {
  CAPABILITY_VERSION,
  PLATFORM_VERSION,
  PLUGIN_VERSION,
  PROFILE_VERSION,
  listPlatformProfiles,
  type CapabilityRegistry,
} from '../capabilities';
import type { AppConfig } from '../types/config';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class CapabilitiesController {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly config: AppConfig,
  ) {}

  listCapabilities = asyncHandler((_req: Request, res: Response) => {
    return sendSuccess(res, {
      architecture: 'architecture.modular-monolith',
      platformVersion: PLATFORM_VERSION,
      versions: {
        platform: PLATFORM_VERSION,
        capability: CAPABILITY_VERSION,
        profile: PROFILE_VERSION,
        plugin: PLUGIN_VERSION,
      },
      capabilities: this.capabilities.discover(this.config),
      profiles: listPlatformProfiles(),
    });
  });
}
