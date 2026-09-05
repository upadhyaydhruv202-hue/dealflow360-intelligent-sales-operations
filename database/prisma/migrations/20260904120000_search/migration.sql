-- CreateTable
CREATE TABLE "search_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "index_name" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "owner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_index_name_document_id_key" ON "search_documents"("index_name", "document_id");

-- CreateIndex
CREATE INDEX "search_documents_index_name_created_at_idx" ON "search_documents"("index_name", "created_at");

-- CreateIndex
CREATE INDEX "search_documents_owner_id_idx" ON "search_documents"("owner_id");

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_index_name_check" CHECK (
    char_length(index_name) BETWEEN 1 AND 64
    AND index_name ~ '^[a-z][a-z0-9._-]*$'
);

ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_document_id_check" CHECK (
    char_length(document_id) BETWEEN 1 AND 128
);

ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_title_len_check" CHECK (
    char_length(title) <= 300
);

ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_body_len_check" CHECK (
    char_length(body) <= 20000
);

ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_keywords_len_check" CHECK (
    char_length(keywords) <= 2000
);

-- pg_trgm supports fuzzy (typo) search for short user-typed queries. Justified for names/SKUs; not a substitute for RAG or Elasticsearch.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "search_documents"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("keywords", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("body", '')), 'B')
  ) STORED;

CREATE INDEX "search_documents_search_vector_idx" ON "search_documents" USING GIN ("search_vector");
CREATE INDEX "search_documents_title_trgm_idx" ON "search_documents" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "search_documents_keywords_trgm_idx" ON "search_documents" USING GIN ("keywords" gin_trgm_ops);
CREATE INDEX "search_documents_filters_idx" ON "search_documents" USING GIN ("filters");
