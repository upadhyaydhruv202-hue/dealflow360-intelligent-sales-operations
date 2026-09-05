-- Shared object store so API and workers can read the same bytes without a shared disk.
CREATE TABLE "stored_objects" (
    "key" TEXT NOT NULL,
    "body" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_key_check" CHECK (
    char_length(key) BETWEEN 1 AND 512
    AND key NOT LIKE '%..%'
    AND key NOT LIKE '/%'
);

ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_size_bytes_check" CHECK (
    size_bytes > 0
);

ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_content_type_len_check" CHECK (
    char_length(content_type) BETWEEN 3 AND 128
);
