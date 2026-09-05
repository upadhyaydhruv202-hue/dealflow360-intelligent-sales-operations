# Natural-language business actions

One-shot intent engine: a user describes an operation in natural language, the model proposes a **registered** command, then the backend validates, authorizes, optionally confirms, and runs a handler.

```text
Natural language
 → intent extraction (structured JSON)
 → allowlist lookup
 → input schema
 → permission check
 → business-rule validation
 → confirmation when high-risk
 → handler
 → audit
```

Hackathons register intents. They do not add arbitrary SQL, JavaScript, shell, HTTP, or Odoo-method intents.

See `docs/intents.md`.
