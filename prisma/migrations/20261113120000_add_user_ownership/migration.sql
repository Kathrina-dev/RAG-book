ALTER TABLE "documents"
ADD COLUMN "user_id" TEXT;

ALTER TABLE "conversations"
ADD COLUMN "user_id" TEXT;

CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

ALTER TABLE "documents"
ADD CONSTRAINT "documents_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;