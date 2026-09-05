import type { ProblemHost } from '../host';

export const DEALFLOW_JOB_NAME = 'dealflow.odoo.sync';
export const DEALFLOW_EVENT_TYPE = 'dealflow.quote.changed';

export function registerDealflowJobs(host: ProblemHost): void {
  host.events.on(DEALFLOW_EVENT_TYPE, (event) => {
    host.logger.info({ eventType: event.type, quoteId: event.payload.quoteId }, 'DealFlow360 quote event');
  });

  host.jobs.process(DEALFLOW_JOB_NAME, async (payload) => {
    await host.events.emit({
      type: DEALFLOW_EVENT_TYPE,
      payload: typeof payload.quoteId === 'string' ? { quoteId: payload.quoteId } : {},
    });
  });
  host.automation?.allowedJobs.allow(DEALFLOW_JOB_NAME);
}

export function registerDealflowOdoo(host: ProblemHost): void {
  if (!host.odooAdapters) {
    return;
  }
  host.odooAdapters.create({
    model: 'res.partner',
    readCapability: 'dealflow.partners.read',
    writeCapability: 'dealflow.partners.write',
  });
  host.odooAdapters.create({
    model: 'product.product',
    readCapability: 'dealflow.products.read',
  });
  host.odooAdapters.create({
    model: 'stock.warehouse',
    readCapability: 'dealflow.warehouses.read',
  });
  host.odooAdapters.create({
    model: 'sale.order',
    readCapability: 'dealflow.sale_orders.read',
    writeCapability: 'dealflow.sale_orders.write',
  });
  host.odooAdapters.create({
    model: 'account.move',
    readCapability: 'dealflow.invoices.read',
    writeCapability: 'dealflow.invoices.write',
  });
}
