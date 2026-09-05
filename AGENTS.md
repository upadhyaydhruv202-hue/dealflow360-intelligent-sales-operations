# HACKATHON STARTER KIT — GLOBAL ENGINEERING INSTRUCTIONS

## 1. PROJECT PURPOSE

This repository is a reusable full-stack starter kit for:

* Odoo hackathons
* AI hackathons
* software engineering hackathons
* college hackathons
* startup MVPs
* academic projects
* prototypes
* rapid production-style applications

The repository must remain generic and reusable.

Do not transform the repository into a single-purpose application.



# 2. PRIMARY ENGINEERING OBJECTIVES

Prioritize in this order:

1. Correctness
2. Security
3. Reliability
4. Maintainability
5. Reusability
6. Fast development
7. Good user experience
8. Performance
9. Scalability

Do not sacrifice correctness merely to add more technologies.

Do not implement a technology simply because it is trendy.



# 3. CORE ARCHITECTURE

The standard architecture is:

Frontend
→ API
→ Controller
→ Service
→ Repository
→ Database

External integrations:

Service
→ Integration Adapter
→ External Provider

Asynchronous execution:

API / Service
→ Queue
→ Worker
→ Service
→ Event / Notification

The architecture must remain modular.



# 4. TECHNOLOGY STACK

## Frontend

* React
* Vite
* Tailwind CSS
* React Router
* React Context where appropriate

## Backend

* Node.js
* Express.js
* REST API
* TypeScript preferred if already established in the project

## Database

* PostgreSQL
* One ORM/query library only

## Infrastructure

* Docker
* Docker Compose
* Redis
* BullMQ or equivalent Node-compatible queue

## CI/CD

* GitHub Actions

## Integrations

* Odoo
* AI provider abstraction
* Email provider abstraction
* SMS provider abstraction
* Storage provider abstraction
* PDF generation



# 5. GENERIC CORE VS PROBLEM-SPECIFIC CODE

The reusable core must remain separate from hackathon-specific business logic.

Reusable capabilities include:

* authentication
* RBAC
* database utilities
* validation
* Odoo integration
* AI integration
* automation
* notifications
* email
* OTP
* file storage
* PDF
* background jobs
* Redis
* logging
* audit
* security
* testing
* Docker
* CI/CD
* reusable frontend UI

Problem-specific implementation belongs under:

modules/problem/

Do not place hackathon-specific business rules into reusable infrastructure.



# 6. ARCHITECTURAL RULES

## Controllers

Controllers must:

* handle HTTP concerns
* validate inputs through schemas
* call services
* return standardized responses

Controllers must NOT:

* contain complex business logic
* directly execute database queries
* directly call Odoo
* directly call Gemini/OpenAI/etc.
* contain large prompt strings
* contain queue-processing logic



## Services

Services contain:

* business logic
* orchestration
* workflows
* policy checks
* transactions
* integration coordination

Services should not contain HTTP-specific behavior.



## Repositories

Repositories contain:

* database queries
* persistence operations
* pagination
* filtering
* sorting

Do not put business logic into repositories.



## Integrations

External providers must be isolated behind adapters.

Examples:

AIService
→ GeminiProvider

EmailService
→ SMTPProvider / ResendProvider / BrevoProvider

StorageService
→ LocalStorageProvider / S3StorageProvider

OdooService
→ OdooClient

Business logic must not depend directly on provider SDKs.



# 7. SECURITY RULES

Never commit:

* API keys
* passwords
* database credentials
* JWT secrets
* Odoo API keys
* SMTP passwords
* AWS credentials
* SMS credentials

Never expose server secrets to the frontend.

Never log:

* passwords
* OTP values
* JWT tokens
* API keys
* private credentials

Use `.env` locally and secure environment variables in deployment.



# 8. AI SECURITY RULES

AI is an untrusted reasoning component.

AI output must never automatically become executable code.

Never allow AI to directly execute:

* arbitrary SQL
* arbitrary JavaScript
* shell commands
* arbitrary HTTP requests
* unrestricted Odoo methods

Use:

AI
→ structured output
→ schema validation
→ authorization
→ business rules
→ approved action

Destructive actions require explicit authorization and confirmation where appropriate.



# 9. ODOO RULES

Odoo credentials are backend-only.

Never expose Odoo API keys to React.

Do not let frontend users directly choose arbitrary Odoo methods.

Use:

* allowlists
* RBAC
* schema validation
* business rules

for sensitive Odoo operations.

The generic Odoo integration must remain independent from any particular hackathon's business logic.



# 10. DATABASE RULES

Use PostgreSQL as the primary persistent relational database unless a future project explicitly requires another database.

Use:

* primary keys
* foreign keys
* unique constraints
* not-null constraints
* check constraints where appropriate
* indexes based on actual query patterns

Do not:

* index every column
* store secrets unnecessarily
* bypass repositories without strong justification



# 11. API RULES

All APIs use:

/api/v1

Use standardized responses.

Success:

{
"success": true,
"data": {},
"meta": {}
}

Error:

{
"success": false,
"error": {
"code": "ERROR_CODE",
"message": "Human-readable message",
"details": {}
},
"requestId": "..."
}

Do not expose internal errors to clients.



# 12. VALIDATION

Validate:

* body
* query parameters
* path parameters
* headers where relevant
* file uploads
* AI output
* external provider output
* configuration

Do not trust frontend validation alone.

Backend validation is authoritative.



# 13. ERROR HANDLING

Use centralized error handling.

Support standardized error types such as:

ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
RateLimitError
ExternalServiceError
DatabaseError
TimeoutError

Avoid duplicated error-handling logic.



# 14. BACKGROUND JOBS

Use background jobs for:

* email
* PDF generation
* AI analysis
* large file processing
* report generation
* Odoo synchronization
* long-running imports

Do not block HTTP requests unnecessarily.

Jobs should support:

* retry
* timeout
* idempotency
* progress where useful
* failure handling



# 15. IDEMPOTENCY

For actions that could accidentally execute twice, use idempotency where appropriate.

Examples:

* sending emails
* sending SMS
* creating external records
* financial operations
* webhook processing
* Odoo writes



# 16. LOGGING

Use structured logs.

Logs should support:

* timestamp
* level
* service
* requestId
* jobId when applicable
* duration
* error information

Never log secrets.



# 17. TESTING

Every new module must include tests. Follow `docs/testing.md`.

At minimum test:

* normal success
* invalid input
* missing data
* duplicate requests / idempotency
* authorization failure
* external provider failure
* timeouts and retries where applicable
* malformed AI output when the module parses AI
* queue and database failures when the module uses them

Do not make tests dependent on real paid external APIs.

Use mocks for:

* AI
* Odoo
* email
* SMS
* storage
* other HTTP providers

Use shared factories in `backend/tests/factories` for users, roles, permissions, notifications, automation rules, documents, and audit events.

A feature is not complete if tests cannot verify its main failure modes.



# 18. DEPENDENCY MANAGEMENT

Before adding a package:

1. Check whether an existing package already solves the problem.
2. Prefer mature and actively maintained libraries.
3. Avoid duplicate libraries solving the same problem.
4. Avoid dependencies that add large complexity without meaningful benefit.

Do not add:

* Kubernetes
* Kafka
* service mesh
* GraphQL
* unnecessary microservices

unless there is a concrete requirement.



# 19. REUSABILITY

Every reusable module should have:

* clear interface
* implementation
* configuration
* validation
* error handling
* tests
* documentation

Provider-specific implementations should remain swappable.



# 20. FEATURE FLAGS

Optional functionality should be controlled through feature flags where useful.

Examples:

FEATURE_AI
FEATURE_ODOO
FEATURE_SMS
FEATURE_S3
FEATURE_RAG
FEATURE_COPILOT
FEATURE_INTENTS
FEATURE_PROBLEM_INTELLIGENCE
FEATURE_CAPABILITY_RECOMMENDATIONS
FEATURE_PROJECT_PLANNING
FEATURE_PROJECT_GENERATOR
FEATURE_ANOMALY_DETECTION
FEATURE_REALTIME
FEATURE_SEARCH

FEATURE_ANALYTICS

Do not use feature flags to bypass security.



# 21. DEMO MODE

Support safe demo mode where practical.

Demo mode may use:

* seeded data
* mock OTP
* mock external integrations
* mock AI
* disabled real-world message delivery

Demo mode must never accidentally behave as production.



# 22. MODIFICATION POLICY

Before changing code:

1. Inspect existing implementation.
2. Understand dependencies.
3. Reuse compatible components.
4. Avoid rewriting unrelated files.
5. Avoid duplicating functionality.
6. Preserve backwards compatibility where practical.

Never rewrite the entire repository just because a new module is being added.



# 23. DOCUMENTATION

Every meaningful module must document:

* purpose
* architecture
* configuration
* public interface
* dependencies
* setup
* examples
* tests
* limitations

Update relevant documentation after implementation.

DealFlow360 golden path: `README.md` (Demo Workflow). Stack decisions: `ARCHITECTURE_DECISION.md`.



# 24. VERIFICATION

After implementing a feature, run where applicable:

* lint
* unit tests
* integration tests
* type checks
* build
* Docker validation

Do not report a feature as complete without verification.

If something cannot be tested, clearly state why.



# 25. FINAL RESPONSE FORMAT

After completing a task, report:

## Implemented

...

## Files Created

...

## Files Modified

...

## Dependencies Added

...

## Environment Variables

...

## API / Interface Changes

...

## Tests

...

## Verification

...

## Known Limitations

...

## Manual Verification

...

Do not claim success where verification was not performed.



# 26. HACKATHON-SPECIFIC PRINCIPLE

Optimize for:

Working Feature
→ Reliable Demo
→ Clean Architecture
→ Security
→ Good UX
→ Performance

Do not optimize for:

* unnecessary abstraction
* theoretical scalability
* excessive microservices
* technology count

The goal is to help the team solve the problem statement rapidly while preserving reusable infrastructure.
