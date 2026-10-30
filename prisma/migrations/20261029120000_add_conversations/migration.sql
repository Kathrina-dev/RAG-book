CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "question_vector" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_messages_conversation_id_sequence_key"
ON "conversation_messages"("conversation_id", "sequence");

CREATE INDEX "conversation_messages_conversation_id_idx"
ON "conversation_messages"("conversation_id");

ALTER TABLE "conversation_messages"
ADD CONSTRAINT "conversation_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;