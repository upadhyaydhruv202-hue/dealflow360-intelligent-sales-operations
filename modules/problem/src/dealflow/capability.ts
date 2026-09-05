import type { ProblemCapability } from '../host';
import { DEALFLOW_PERMISSIONS } from '../permissions';

export const DEALFLOW_CAPABILITY: ProblemCapability = {
  name: 'problem.dealflow',
  version: '0.1.0',
  kind: 'application',
  category: 'core',
  maturity: 'beta',
  summary: 'DealFlow360 quote governance, approval, fulfillment, and hybrid billing.',
  dependencies: ['problem.module'],
  optionalDependencies: ['integration.odoo'],
  conflicts: [],
  environmentRequirements: [],
  infrastructureRequirements: [],
  providerRequirements: [],
  permissions: DEALFLOW_PERMISSIONS.map((permission) => permission.key),
  architectureCompatibility: ['architecture.modular-monolith'],
  deploymentCompatibility: ['deployment.local-hybrid', 'deployment.docker-compose'],
  frontendAvailability: true,
  backendAvailability: true,
  workerRequirement: true,
  databaseRequirement: true,
  tests: [
    'modules/problem/src/module.test.ts',
    'modules/problem/src/dealflow/service.test.ts',
    'backend/src/problem/host.http.test.ts',
    'backend/tests/problem.http.test.ts',
  ],
  documentation: ['docs/problem-module.md', 'modules/problem/README.md'],
};
