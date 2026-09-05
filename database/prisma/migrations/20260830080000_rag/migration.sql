-- CreateTable
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "text_hash" TEXT NOT NULL,
    "chunk_count" INTEGER NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" JSONB NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rag_documents_created_at_idx" ON "rag_documents"("created_at");

-- CreateIndex
CREATE INDEX "rag_documents_created_by_idx" ON "rag_documents"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "rag_chunks_document_id_chunk_index_key" ON "rag_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "rag_chunks_document_id_idx" ON "rag_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "rag_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_id_len_check" CHECK (
    char_length(id) BETWEEN 1 AND 128
);

ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_source_len_check" CHECK (
    char_length(source) BETWEEN 1 AND 256
);

ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_text_hash_len_check" CHECK (
    char_length(text_hash) = 64
);

ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_chunk_count_check" CHECK (
    chunk_count >= 0 AND chunk_count <= 1000
);

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_id_len_check" CHECK (
    char_length(id) BETWEEN 1 AND 160
);

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_source_len_check" CHECK (
    char_length(source) BETWEEN 1 AND 256
);

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_chunk_index_check" CHECK (
    chunk_index >= 0
);

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_content_len_check" CHECK (
    char_length(content) BETWEEN 1 AND 20000
);

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_embedding_model_len_check" CHECK (
    char_length(embedding_model) BETWEEN 1 AND 128
);
