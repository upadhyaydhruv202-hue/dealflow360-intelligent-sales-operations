# Integrations

External providers are isolated behind adapters.

* Odoo JSON-2 client — `backend/src/integrations/odoo` (see `docs/odoo.md`)
* AI providers — `backend/src/integrations/ai` (see `docs/ai.md`)
* Optional RAG — `backend/src/integrations/rag` (see `docs/rag.md`)
* Optional search — `backend/src/integrations/search` (see `docs/search.md`)
* Optional analytics — `backend/src/integrations/analytics` (see `docs/analytics.md`)
* Optional anomaly engine — `backend/src/anomaly` (see `docs/anomaly.md`)
* Document intelligence — `backend/src/integrations/documents` (see `docs/documents.md`)
* Storage providers — `backend/src/integrations/storage` (see `docs/storage.md`)
* Email providers — `backend/src/integrations/email` (see `docs/email.md`)
* OTP — `backend/src/otp` (see `docs/otp.md`)
* PDF generation — `backend/src/integrations/pdf` (see `docs/pdf.md`)
* SMS providers — `backend/src/integrations/sms` (see `docs/sms.md`)

Business logic must not import provider SDKs directly. Frontend code must not receive Odoo, AI, or SMTP credentials.
