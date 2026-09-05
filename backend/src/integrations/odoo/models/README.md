# Odoo model adapters

Bind a technical Odoo model to `OdooService.execute` with `createOdooModelAdapter({ model, service, readCapability, writeCapability })`.

Example (belongs in a hackathon module, not in the reusable client):

```ts
import { createOdooModelAdapter } from '../index';

export function createPartnerAdapter(service: Parameters<typeof createOdooModelAdapter>[0]['service']) {
  return createOdooModelAdapter({
    model: 'res.partner',
    service,
    readCapability: 'partners.read',
    writeCapability: 'partners.write',
  });
}
```

Full guide: `docs/odoo.md`.
