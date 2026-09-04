import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", [
  "WAITING",
  "SERVING",
  "DONE",
  "SKIPPED",
]);

export type TicketStatus = (typeof ticketStatus.enumValues)[number];

export const tickets = pgTable(
  "tickets",
  {
    // Internal bigint PK (GENERATED ALWAYS AS IDENTITY) — tidak pernah di-expose ke FE.
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    // Public identifier untuk FE. Hash index non-unique (sengaja tidak unique).
    uuid: uuid("uuid").defaultRandom().notNull(),
    // Tanggal bisnis (Asia/Jakarta) — diisi aplikasi dari createdAt.
    // Dipakai untuk counter harian, filter display, dan arsip. Tidak pernah di-delete.
    bizDate: date("biz_date").notNull(),
    loket: smallint("loket").notNull(),
    number: integer("number").notNull(),
    code: text("code").notNull(),
    status: ticketStatus("status").notNull().default("WAITING"),
    // Semua waktu operasional timestamptz. BE kirim ISO UTC, FE render pakai timezone sistem.
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    calledAt: timestamp("called_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => [
    index("tickets_uuid_hash_idx").using("hash", t.uuid),
    uniqueIndex("tickets_biz_loket_number_uniq").on(t.bizDate, t.loket, t.number),
    uniqueIndex("tickets_biz_loket_code_uniq").on(t.bizDate, t.loket, t.code),
    index("tickets_biz_loket_status_number_idx").on(
      t.bizDate,
      t.loket,
      t.status,
      t.number
    ),
  ]
);

export const dailyCounters = pgTable(
  "daily_counters",
  {
    bizDate: date("biz_date").notNull(),
    loket: smallint("loket").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bizDate, t.loket] })]
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
