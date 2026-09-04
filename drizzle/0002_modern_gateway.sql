-- serial -> bigint GENERATED ALWAYS: buang default + sequence lama (namanya tabrakan
-- dengan sequence identity baru), convert tipe, pasang identity, majukan sequence lewat max(id).
ALTER TABLE "tickets" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "tickets_id_seq";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY;--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"tickets"', 'id'), (SELECT COALESCE(MAX("id"), 0) FROM "tickets"));
