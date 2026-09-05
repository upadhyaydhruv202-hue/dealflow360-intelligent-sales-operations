import { Router } from 'express';

import { registerContributorCapabilities } from '../capabilities';
import { API_PREFIX } from '../constants';
import { isPermissionKey } from '../rbac/names';
import type { ProblemHost, ProblemModule } from './types';

export function applyProblemModule(host: ProblemHost, module: ProblemModule): void {
  assertProblemId(module.id);
  for (const permission of module.permissions) {
    if (!isPermissionKey(permission.key)) {
      throw new Error(`Problem module "${module.id}" has invalid permission key "${permission.key}"`);
    }
  }

  if (module.capabilities?.length && host.capabilities) {
    registerContributorCapabilities(host.capabilities, [
      { name: `problem.${module.id}`, capabilities: module.capabilities },
    ]);
  }

  module.register(host);
  host.logger.info({ moduleId: module.id, stage: host.stage }, 'Problem module registered');
}

export function mountProblemRouter(app: { use: (path: string, router: Router) => unknown }) {
  return (basePath: string, router: Router): void => {
    const suffix = basePath.startsWith('/') ? basePath : `/${basePath}`;
    app.use(`${API_PREFIX}${suffix}`, router);
  };
}

function assertProblemId(id: string): void {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) {
    throw new Error(`Problem module id "${id}" must be a lowercase slug`);
  }
}
