CREATE TYPE "public"."ticket_status" AS ENUM('WAITING', 'SERVING', 'DONE', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "daily_counters" (
	"biz_date" date NOT NULL,
	"loket" smallint NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_counters_biz_date_loket_pk" PRIMARY KEY("biz_date","loket")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"biz_date" date NOT NULL,
	"loket" smallint NOT NULL,
	"number" integer NOT NULL,
	"code" text NOT NULL,
	"status" "ticket_status" DEFAULT 'WAITING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_biz_loket_number_uniq" ON "tickets" USING btree ("biz_date","loket","number");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_biz_loket_code_uniq" ON "tickets" USING btree ("biz_date","loket","code");--> statement-breakpoint
CREATE INDEX "tickets_biz_loket_status_number_idx" ON "tickets" USING btree ("biz_date","loket","status","number");