import type { PrismaClient } from '@prisma/client';
import { describe } from 'vitest';

import { createPrismaClient } from '../../src/lib/prisma';
import { createRepositories, type Repositories } from '../../src/repositories';
import { createUser, TEST_PASSWORD_HASH } from '../factories';

export { TEST_PASSWORD_HASH };

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export const describeDatabase = hasDatabaseUrl() ? describe : describe.skip;

let prisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for database tests');
  }

  if (!prisma) {
    prisma = createPrismaClient({
      url,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
  }

  return prisma;
}

export function getTestRepositories(): Repositories {
  return createRepositories(getTestPrisma());
}

export async function resetDatabase(client: PrismaClient = getTestPrisma()): Promise<void> {
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      rag_chunks,
      rag_documents,
      search_documents,
      analytics_facts,
      anomaly_findings,
      copilot_messages,
      copilot_conversations,
      audit_events,
      document_extractions,
      documents,
      stored_files,
      stored_objects,
      refresh_tokens,
      notification_preferences,
      notifications,
      notification_deliveries,
      automation_action_runs,
      automation_executions,
      automation_rules,
      user_roles,
      role_permissions,
      users,
      roles,
      permissions,
      df_quote_revisions,
      df_quote_billing_schedules,
      df_quote_backorders,
      df_quote_fulfillment_splits,
      df_quote_approvals,
      df_quote_lines,
      df_quotes,
      df_approval_chain_steps,
      df_approval_chains,
      df_discount_policies,
      df_stock_levels,
      df_product_relations,
      df_products,
      df_warehouses,
      df_customers
    CASCADE
  `);
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

export async function createTestUser(
  overrides: {
    email?: string;
    displayName?: string;
    status?: 'active' | 'invited' | 'disabled';
  } = {},
) {
  return createUser(getTestRepositories(), overrides);
}
