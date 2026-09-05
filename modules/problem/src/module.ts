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
    notify: host.notifications?.notify ?? null,
    publish: async (event) => {
      await host.events.emit({
        type: `dealflow.${event.type}`,
        payload: { quoteId: event.quoteId, ...event.payload },
      });
      await host.realtime?.publish({
        channel: 'dashboard',
        type: 'dashboard.updated',
        payload: { kind: 'dealflow', source: 'dealflow', event: event.type, quoteId: event.quoteId, ...event.payload },
      });
    },
    odoo: {
      enabled: Boolean(host.odoo?.runtime?.enabled),
      createSaleOrder: host.odoo?.create
        ? async (input) => {
            const created = await host.odoo!.create!({
              capability: 'dealflow.sale_orders.write',
              model: 'sale.order',
              values: [
                {
                  name: input.quoteNumber,
                  partner_name: input.customerName,
                  amount_total: input.netTotal,
                },
              ],
              internal: true,
            });
            const id = Array.isArray(created) ? created[0] : created;
            return Number(id);
          }
        : undefined,
    },
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
    host.events.on('user.created', async (event) => {
      const email = String(event.payload.email ?? '').trim();
      if (!email) {
        return;
      }
      await createService(host).provisionCustomer({
        email,
        displayName: String(event.payload.displayName ?? ''),
        companyName: typeof event.payload.companyName === 'string' ? event.payload.companyName : undefined,
      });
    });
    if (host.stage === 'api' && host.mount && host.http) {
      const service = createService(host);
      host.mount('/problem', createProblemManifestRouter(host));
      host.mount('/dealflow', createDealflowRouter(host, service));
    }
  },
};
