-- id lama (uuid, PK) dipakai ulang sebagai kolom uuid publik supaya data istniejących tidak hilang.
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_pkey";--> statement-breakpoint
ALTER TABLE "tickets" RENAME COLUMN "id" TO "uuid";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "id" SERIAL PRIMARY KEY;--> statement-breakpoint
CREATE INDEX "tickets_uuid_hash_idx" ON "tickets" USING hash ("uuid");
