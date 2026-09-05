# Optional RAG

Provider-agnostic semantic search and retrieval-augmented generation. Future projects can search large document collections by meaning without coupling business logic to one embedding vendor or vector database.

RAG is **off by default**. The rest of the starter kit does not import or require it. Enable `FEATURE_RAG=true` (and a ready AI provider) only when a problem statement needs it.

See `backend/src/integrations/rag/` for the implementation.

## Pipeline

```text
Document
 → Chunker
 → EmbeddingProvider
 → VectorStore
 → Retriever
 → context assembly
 → AIService (schema-validated answer + sources)
```

```text
Controller (HTTP + zod + authenticate + requirePermission("rag.use"))
        │
        ▼
RAGService
        │
        ├── Chunker
        ├── EmbeddingProvider  (lexical mock | AIService.embed / Gemini)
        ├── VectorStore        (memory | postgres JSON embeddings)
        └── Retriever
```

Hackathons swap `EmbeddingProvider` or `VectorStore`. They do not put Pinecone, pgvector, or Gemini SDK calls in controllers or problem modules.

## Enable

| Variable                      | Default                                              | Notes                                                                                                           |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `FEATURE_RAG`                 | `false`                                              | Turns the HTTP API, service, and optional Copilot `searchKnowledge` tool on                                     |
| `FEATURE_AI` / `AI_ENABLED`   | `false`                                              | RAG still needs a ready AI provider to answer. Mock/demo uses a lexical embedder so CI does not call a paid API |
| `RAG_VECTOR_STORE`            | `postgres` when `DATABASE_URL` is set, else `memory` | `memory` (process-local) or `postgres` (JSON embeddings in `rag_documents` / `rag_chunks`)                      |
| `RAG_CHUNK_SIZE`              | `800`                                                | Target chunk size in characters                                                                                 |
| `RAG_CHUNK_OVERLAP`           | `120`                                                | Overlap between adjacent chunks                                                                                 |
| `RAG_TOP_K`                   | `5`                                                  | Default retrieved chunks                                                                                        |
| `RAG_MIN_SCORE`               | `0.28`                                               | Cosine similarity floor. Hits below this are dropped                                                            |
| `RAG_MAX_CONTEXT_CHARS`       | `12000`                                              | Cap on assembled untrusted context sent to the model                                                            |
| `RAG_MAX_DOCUMENT_CHARS`      | `100000`                                             | Index payload size cap                                                                                          |
| `RAG_MAX_CHUNKS_PER_DOCUMENT` | `200`                                                | Hard cap per document                                                                                           |
| `RAG_ASYNC_THRESHOLD_CHARS`   | `20000`                                              | Larger texts enqueue `rag.index` unless `async: false`                                                          |

After migrating, re-seed or assign `rag.use` so manager/admin receive the new permission.

`RAG_VECTOR_STORE=postgres` without `DATABASE_URL` falls back to memory and logs a warning. When `FEATURE_RAG` is on and `DATABASE_URL` is set, the default is Postgres so the API and workers share the same index. Postgres storage does **not** require the pgvector extension; similarity is computed in the service. That is enough for hackathon-scale collections. Replace `VectorStore` with a dedicated engine if you later need ANN search.

## HTTP API

Prefix `/api/v1`. Bearer token and `rag.use` required (manager and admin by default). Index, get, delete, search, and ask are scoped to the authenticated user. Copilot `searchKnowledge` uses the same owner filter. AI rate limits apply.

| Method | Path                 | Description                                                      |
| ------ | -------------------- | ---------------------------------------------------------------- |
| POST   | `/rag/index`         | Chunk, embed, and store a document (`201`, or `202` when queued) |
| GET    | `/rag/documents/:id` | Indexed document metadata for documents the caller indexed       |
| DELETE | `/rag/documents/:id` | Remove a document the caller indexed                             |
| POST   | `/rag/search`        | Retrieve chunks from the caller's index (no LLM)                 |
| POST   | `/rag/ask`           | Retrieve the caller's index, assemble context, answer with sources |

Index body:

```json
{
  "documentId": "optional-stable-id",
  "source": "Refund policy",
  "text": "Customers may request a refund within 14 days...",
  "metadata": { "collection": "policies" },
  "async": false
}
```

Ask / search body:

```json
{
  "query": "What is the refund window for a late shipment?",
  "topK": 5,
  "minScore": 0.28,
  "documentIds": ["refund-policy"]
}
```

Ask response:

```json
{
  "answer": "Customers may request a refund within 14 days of delivery when a shipment arrives late.",
  "grounded": true,
  "confidence": 0.86,
  "sources": [
    {
      "documentId": "refund-policy",
      "chunkId": "refund-policy:0000",
      "source": "Refund policy",
      "quote": "Customers may request a refund within 14 days...",
      "score": 0.81
    }
  ],
  "unsupported": [],
  "injectionSignals": []
}
```

Each retrieved chunk includes `documentId`, `chunkId`, `source`, `metadata`, and a relevance `score`.

If nothing clears `minScore`, the service **does not call the model**. `grounded` is false and the answer states that evidence is missing. The grounding policy also drops invented source ids.

## Abstractions

| Interface           | Role                    | Built-in implementations                                                          |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `Chunker`           | Split text              | `RecursiveCharacterChunker`                                                       |
| `EmbeddingProvider` | Vectorize text          | `LexicalEmbeddingProvider` (mock/demo), `AiEmbeddingProvider` (`AIService.embed`) |
| `VectorStore`       | Persist / query vectors | `MemoryVectorStore`, `PostgresVectorStore`                                        |
| `Retriever`         | Query → scored chunks   | `SimilarityRetriever`                                                             |
| `RAGService`        | Index, search, ask      | `createRagService()`                                                              |

```ts
import {
  createMemoryVectorStore,
  createRagService,
  LexicalEmbeddingProvider,
} from '../integrations/rag';

const rag = createRagService({
  config,
  logger,
  ai,
  store: createMemoryVectorStore(),
  embeddings: new LexicalEmbeddingProvider(),
});
```

Problem modules index their own corpora. Document intelligence does **not** auto-index uploads.

## Security

Documents and questions are untrusted.

- Context is wrapped with `wrapUntrustedData('document' | 'user', …)`
- Prompt-injection patterns are detected on the query and on chunks (`injectionSignals` on the answer). Chunks are still stored as data; they never become system instructions
- Retrieval threshold (`RAG_MIN_SCORE`) and context size (`RAG_MAX_CONTEXT_CHARS`) cap what the model sees
- Structured answers are schema-validated. Sources that do not match retrieved `chunkId` / `documentId` pairs are stripped. `grounded` is forced false when no real source remains
- The model is never asked to execute SQL, shell, or Odoo methods. RAG does not run retrieved text

Demo / mock embeddings are lexical (overlapping tokens). They are not a production embedding model. Use Gemini (`AIService.embed`) or inject another `EmbeddingProvider` for real semantic search.

## Copilot

When both Copilot and RAG are enabled, the allowlisted tool `searchKnowledge` (`rag.use`) returns retrieved chunks. The planner still cannot execute arbitrary retrieval backends.

## Frontend

`/rag` is a demo page (index + ask) behind `FeatureGate`. The nav link appears only when `FEATURE_RAG` is on. UX hiding is not authorization.

## Tests

Covered:

- indexing and retrieval
- missing documents
- low relevance / insufficient evidence
- prompt injection in retrieved text
- source attribution
- HTTP authz and `FEATURE_DISABLED`

## Limitations

- Set `RAG_VECTOR_STORE=memory` only for single-process demos. The default is Postgres whenever `DATABASE_URL` is set so `rag.index` jobs and HTTP search share an index
- Postgres JSON + in-process cosine scan is not approximate nearest neighbor. Do not point this at millions of chunks without swapping the store
- Lexical embeddings are for tests and mock/demo only
- Re-indexing the same `documentId` replaces chunks (idempotent write)
- Indexed documents are scoped to the caller who indexed them. Callers with `rag.use` cannot search, ask, get, or delete another user's documents
- Document intelligence does not auto-index uploads
