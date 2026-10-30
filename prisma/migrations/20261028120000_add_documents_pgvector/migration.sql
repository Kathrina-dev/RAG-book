CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key"
ON "document_chunks"("document_id", "chunk_index");

CREATE INDEX "document_chunks_document_id_idx"
ON "document_chunks"("document_id");

ALTER TABLE "document_chunks"
ADD CONSTRAINT "document_chunks_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
