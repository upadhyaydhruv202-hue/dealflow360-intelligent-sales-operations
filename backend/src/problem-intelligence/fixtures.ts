import { UNKNOWN_VALUE, type ProblemIntelligenceDraft } from './types';

/** Valid structured draft used by unit tests. Not executed. */
export function buildProblemIntelligenceDraft(
  overrides: Partial<ProblemIntelligenceDraft> = {},
): ProblemIntelligenceDraft {
  return {
    problemSummary:
      'Staff log in and record a work item so a manager can review the result in a dashboard.',
    users: [
      { name: 'Staff', description: 'Creates the core record.' },
      { name: 'Manager', description: 'Reviews the result.' },
    ],
    actors: [
      { name: 'Staff user', kind: 'human', description: 'Authenticated application user.' },
      { name: 'PostgreSQL', kind: 'system', description: 'Stores application records.' },
    ],
    workflows: [
      {
        name: 'Golden path',
        steps: ['Login', 'Create work item', 'Manager reviews the item'],
        actors: ['Staff user', 'Manager'],
      },
    ],
    entities: [{ name: 'Work item', fields: ['title', 'status'], description: 'Core domain record.' }],
    businessRules: [{ name: 'Only staff may create work items', description: 'unknown' }],
    integrations: UNKNOWN_VALUE,
    odooRequirements: UNKNOWN_VALUE,
    aiRequirements: UNKNOWN_VALUE,
    automationRequirements: UNKNOWN_VALUE,
    notifications: UNKNOWN_VALUE,
    documents: UNKNOWN_VALUE,
    reports: UNKNOWN_VALUE,
    securityRequirements: [{ name: 'Authenticate before the golden path', description: 'Use platform auth.' }],
    nonFunctionalRequirements: [
      { name: 'Demo must work without paid APIs', description: 'Mock providers in demo mode.' },
    ],
    likelyDataRequirements: [{ name: 'work_items table', description: 'PostgreSQL via Prisma.' }],
    likelyInfrastructureRequirements: [{ name: 'postgres', description: 'Primary database.' }],
    mappings: [
      {
        requirement: 'Users must log in',
        category: 'security',
        existingCapability: 'auth',
        newProblemLogic: UNKNOWN_VALUE,
        confidence: 0.93,
        evidence: 'The statement requires authenticated access.',
      },
      {
        requirement: 'Store hackathon-specific work items',
        category: 'entity',
        existingCapability: 'database',
        newProblemLogic: 'Define the work-item model and services under modules/problem.',
        confidence: 0.88,
      },
    ],
    confidence: 0.78,
    uncertainty: ['Integrations were not stated in the problem statement.'],
    unknowns: ['Odoo models', 'Notification channels'],
    requiresReview: true,
    ...overrides,
  };
}
