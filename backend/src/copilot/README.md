# Copilot

Controlled assistant: authenticated users ask questions, an AI planner may select **allowlisted** tools, then RBAC + schema validation run before any handler.

```text
User message
 → authentication
 → AI planner
 → tool allowlist
 → RBAC
 → schema validation
 → confirmation (high-risk)
 → handler
 → result validation
 → AI response
 → audit
```

Hackathons register tools with `registry.register({ name, description, inputSchema, requiredPermission, riskLevel, handler })`. Do not add arbitrary SQL, JS, shell, HTTP, or Odoo method tools.

See `docs/copilot.md`.
