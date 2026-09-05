# Problem statement intelligence

Converts an arbitrary hackathon problem statement into a structured technical specification, then classifies each requirement against the platform capability catalog.

```text
Problem statement (untrusted)
 → input limits + redaction + injection signals
 → fenced prompt (no tools)
 → AI structured JSON
 → Zod schema validation
 → catalog classification (existing vs new problem logic)
 → confidence / unknowns / review
 → audit (no statement text, no secrets)
```

The model cannot execute SQL, Odoo, HTTP, filesystem, or git. Hallucinated capability names are dropped from "existing" and recorded as uncertainty.

See `docs/problem-intelligence.md`.
