-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'processing', 'completed', 'failed', 'needs_review');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('invoice', 'receipt', 'certificate', 'application', 'form', 'contract', 'report', 'generic');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "stored_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "requested_fields" JSONB NOT NULL,
    "extracted_text_length" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "fields" JSONB NOT NULL,
    "missing_fields" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "warnings" JSONB NOT NULL,
    "requires_review" BOOLEAN NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "prompt_id" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_user_id_created_at_idx" ON "documents"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "document_extractions_document_id_key" ON "document_extractions"("document_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints (Prisma schema does not model CHECK yet)
ALTER TABLE "documents" ADD CONSTRAINT "documents_original_filename_len_check" CHECK (
    char_length(original_filename) BETWEEN 1 AND 255
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_stored_filename_len_check" CHECK (
    char_length(stored_filename) BETWEEN 1 AND 255
    AND stored_filename NOT LIKE '%..%'
    AND stored_filename !~ '[\\/]'
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_storage_key_check" CHECK (
    char_length(storage_key) BETWEEN 1 AND 512
    AND storage_key NOT LIKE '%..%'
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_mime_type_len_check" CHECK (
    char_length(mime_type) BETWEEN 3 AND 128
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_extension_check" CHECK (
    extension IN ('pdf', 'png', 'jpg', 'jpeg', 'txt')
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_size_bytes_check" CHECK (
    size_bytes > 0
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_checksum_len_check" CHECK (
    char_length(checksum_sha256) = 64
);

ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_confidence_check" CHECK (
    confidence >= 0 AND confidence <= 1
);
