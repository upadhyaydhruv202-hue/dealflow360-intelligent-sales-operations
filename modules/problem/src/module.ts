import { DEALFLOW_CAPABILITY } from './dealflow/capability';
import { DEALFLOW_MODULE_ID } from './dealflow/constants';
import { registerDealflowJobs, registerDealflowOdoo } from './dealflow/jobs';
import { createDealflowRouter, createProblemManifestRouter } from './dealflow/routes';
import { createDealflowService } from './dealflow/service';
import { createMemoryStore } from './dealflow/store';
import { createPrismaStore } from './dealflow/prisma-store';
import type { ProblemHost, ProblemModule } from './host';
import { DEALFLOW_PERMISSIONS, DEALFLOW_ROLE_PERMISSIONS } from './permissions';

function createService(host: ProblemHost) {
  return createDealflowService({
    store: host.prisma ? createPrismaStore(host.prisma) : createMemoryStore(),
    audit: host.audit ?? null,
  });
}

export const problemModule: ProblemModule = {
  id: DEALFLOW_MODULE_ID,
  permissions: DEALFLOW_PERMISSIONS,
  rolePermissions: DEALFLOW_ROLE_PERMISSIONS,
  capabilities: [DEALFLOW_CAPABILITY],
  register(host: ProblemHost) {
    registerDealflowJobs(host);
    registerDealflowOdoo(host);
    if (host.stage === 'api' && host.mount && host.http) {
      const service = createService(host);
      host.mount('/problem', createProblemManifestRouter(host));
      host.mount('/dealflow', createDealflowRouter(host, service));
    }
  },
};
