-- Hand-written: add nullable, backfill existing rows, then tighten to NOT NULL.
ALTER TABLE "refresh_tokens" ADD COLUMN "session_started_at" TIMESTAMP(3);
UPDATE "refresh_tokens" SET "session_started_at" = "created_at";
ALTER TABLE "refresh_tokens" ALTER COLUMN "session_started_at" SET NOT NULL;
