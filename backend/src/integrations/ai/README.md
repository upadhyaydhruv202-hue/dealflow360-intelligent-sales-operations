# AI integration

Provider-agnostic LLM client, Gemini REST adapter, mock provider, schema-validated structured output, versioned intelligence-toolkit prompts, and a shared guardrails layer (input limits, redaction, untrusted-data fencing, tool allowlisting, confirmation, audit).

See `docs/ai.md` and `docs/ai-guardrails.md` for setup, HTTP routes, toolkit operations, and safety controls.

Controllers and problem modules must call `AIService`. They never import a vendor SDK or contain prompt strings. AI output is untrusted and must be schema-validated before use.
