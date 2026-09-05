# Odoo integration

Generic Odoo 19 JSON-2 client, operations, capability allowlist, and model-adapter factory.

See `docs/odoo.md` for setup, security rules, and how to add `partner.adapter` / `order.adapter` / `inventory.adapter` without changing this client.

Do not expose arbitrary Odoo method execution to the frontend. Do not put problem-specific business rules here.
