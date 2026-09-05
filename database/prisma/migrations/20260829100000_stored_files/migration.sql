-- Uploaded file metadata. Bytes remain in object storage (local, S3, or stored_objects).
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");
CREATE INDEX "stored_files_uploaded_by_created_at_idx" ON "stored_files"("uploaded_by", "created_at");
CREATE INDEX "stored_files_purpose_created_at_idx" ON "stored_files"("purpose", "created_at");

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_storage_key_check" CHECK (
    char_length(storage_key) BETWEEN 1 AND 512
    AND storage_key NOT LIKE '%..%'
    AND storage_key NOT LIKE '/%'
);

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_size_bytes_check" CHECK (
    size_bytes > 0
);

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_names_check" CHECK (
    char_length(original_name) BETWEEN 1 AND 255
    AND char_length(stored_name) BETWEEN 1 AND 255
    AND original_name NOT LIKE '%..%'
    AND stored_name NOT LIKE '%..%'
    AND original_name NOT LIKE '%/%'
    AND stored_name NOT LIKE '%/%'
);

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_purpose_check" CHECK (
    purpose IN ('attachment', 'avatar', 'export', 'document', 'report')
);

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_provider_check" CHECK (
    provider IN ('local', 's3', 'postgres')
);

INSERT INTO permissions (id, key, description, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'files.read',
    'Read uploaded files and signed download URLs',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'files.write',
    'Upload and delete files',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'manager', 'staff', 'user')
  AND p.key IN ('files.read', 'files.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;
