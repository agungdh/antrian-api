import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { dailyCounters, tickets, type Ticket } from "../db/schema";
import {
  assertLoket,
  codeFor,
  maxPerDay,
  todayBizDate,
} from "../lib/date";

export type TicketPublic = {
  id: string;
  loket: number;
  number: number;
  code: string;
  status: string;
  createdAt: string;
  calledAt: string | null;
  finishedAt: string | null;
};

export type LoketSnapshot = {
  current: TicketPublic | null;
  waiting: TicketPublic[];
  waitingCount: number;
};

export type QueueSnapshot = {
  date: string;
  loket1: LoketSnapshot;
  loket2: LoketSnapshot;
};

function toPublic(t: Ticket): TicketPublic {
  return {
    id: t.id,
    loket: t.loket,
    number: t.number,
    code: t.code,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    calledAt: t.calledAt ? t.calledAt.toISOString() : null,
    finishedAt: t.finishedAt ? t.finishedAt.toISOString() : null,
  };
}

function emptyLoket(): LoketSnapshot {
  return { current: null, waiting: [], waitingCount: 0 };
}

/** Ambil nomor baru untuk loket. Atomik via daily_counters, max 1000/hari/loket. */
export async function takeTicket(loket: number): Promise<{
  ticket: TicketPublic;
  position: number;
  snapshot: QueueSnapshot;
}> {
  assertLoket(loket);
  const bizDate = todayBizDate();

  const ticket = await db.transaction(async (tx) => {
    const counterRows = await tx
      .insert(dailyCounters)
      .values({ bizDate, loket, lastNumber: 1 })
      .onConflictDoUpdate({
        target: [dailyCounters.bizDate, dailyCounters.loket],
        set: { lastNumber: sql`${dailyCounters.lastNumber} + 1` },
      })
      .returning();

    const nextNumber = counterRows[0]?.lastNumber ?? 1;
    if (nextNumber > maxPerDay()) throw new Error("QUOTA_FULL");

    const code = codeFor(loket, nextNumber);
    const rows = await tx
      .insert(tickets)
      .values({ bizDate, loket, number: nextNumber, code, status: "WAITING" })
      .returning();
    return rows[0]!;
  });

  const snapshot = await getSnapshot();
  const waiting = snapshot[loket === 1 ? "loket1" : "loket2"].waiting;
  const position = waiting.findIndex((t) => t.id === ticket.id) + 1;
  return { ticket: toPublic(ticket), position, snapshot };
}

/** Snapshot hari ini (default) — source of truth untuk display & SSE connect pertama. */
export async function getSnapshot(bizDate: string = todayBizDate()): Promise<QueueSnapshot> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.bizDate, bizDate))
    .orderBy(asc(tickets.number));

  const loket1 = emptyLoket();
  const loket2 = emptyLoket();

  for (const r of rows) {
    const slot = r.loket === 1 ? loket1 : loket2;
    if (r.status === "SERVING" && !slot.current) {
      slot.current = toPublic(r);
    } else if (r.status === "WAITING") {
      slot.waiting.push(toPublic(r));
    }
  }
  loket1.waitingCount = loket1.waiting.length;
  loket2.waitingCount = loket2.waiting.length;

  return { date: bizDate, loket1, loket2 };
}

/** Panggil antrian berikutnya: SERVING lama -> DONE, WAITING terkecil -> SERVING. */
export async function callNext(loket: number) {
  assertLoket(loket);
  const bizDate = todayBizDate();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const serving = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.bizDate, bizDate),
          eq(tickets.loket, loket),
          eq(tickets.status, "SERVING")
        )
      )
      .limit(1)
      .for("update");

    let finished: Ticket | null = null;
    if (serving[0]) {
      const upd = await tx
        .update(tickets)
        .set({ status: "DONE", finishedAt: now })
        .where(eq(tickets.id, serving[0].id))
        .returning();
      finished = upd[0] ?? null;
    }

    const waiting = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.bizDate, bizDate),
          eq(tickets.loket, loket),
          eq(tickets.status, "WAITING")
        )
      )
      .orderBy(asc(tickets.number))
      .limit(1)
      .for("update");

    let current: Ticket | null = null;
    if (waiting[0]) {
      const upd = await tx
        .update(tickets)
        .set({ status: "SERVING", calledAt: now })
        .where(eq(tickets.id, waiting[0].id))
        .returning();
      current = upd[0] ?? null;
    }

    return { finished, current };
  });

  const snapshot = await getSnapshot();
  return {
    finished: result.finished ? toPublic(result.finished) : null,
    current: result.current ? toPublic(result.current) : null,
    snapshot,
  };
}

/** Ambil SERVING saat ini tanpa mengubah status (untuk recall). */
export async function getCurrent(loket: number): Promise<TicketPublic | null> {
  assertLoket(loket);
  const bizDate = todayBizDate();
  const rows = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.bizDate, bizDate),
        eq(tickets.loket, loket),
        eq(tickets.status, "SERVING")
      )
    )
    .limit(1);
  return rows[0] ? toPublic(rows[0]) : null;
}

/** Recall: update calledAt ulang supaya display tahu ini panggilan ulang (FE bunyi lagi). */
export async function recallCurrent(loket: number) {
  assertLoket(loket);
  const bizDate = todayBizDate();
  const now = new Date();

  const rows = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.bizDate, bizDate),
        eq(tickets.loket, loket),
        eq(tickets.status, "SERVING")
      )
    )
    .limit(1);

  if (!rows[0]) {
    const snapshot = await getSnapshot();
    return { current: null as TicketPublic | null, snapshot };
  }

  const upd = await db
    .update(tickets)
    .set({ calledAt: now })
    .where(eq(tickets.id, rows[0].id))
    .returning();

  const snapshot = await getSnapshot();
  return { current: upd[0] ? toPublic(upd[0]) : null, snapshot };
}

/** Skip: SERVING -> SKIPPED, langsung panggil WAITING berikutnya kalau ada. */
export async function skipCurrent(loket: number) {
  assertLoket(loket);
  const bizDate = todayBizDate();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const serving = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.bizDate, bizDate),
          eq(tickets.loket, loket),
          eq(tickets.status, "SERVING")
        )
      )
      .limit(1)
      .for("update");

    let skipped: Ticket | null = null;
    if (serving[0]) {
      const upd = await tx
        .update(tickets)
        .set({ status: "SKIPPED", finishedAt: now })
        .where(eq(tickets.id, serving[0].id))
        .returning();
      skipped = upd[0] ?? null;
    }

    const waiting = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.bizDate, bizDate),
          eq(tickets.loket, loket),
          eq(tickets.status, "WAITING")
        )
      )
      .orderBy(asc(tickets.number))
      .limit(1)
      .for("update");

    let current: Ticket | null = null;
    if (waiting[0]) {
      const upd = await tx
        .update(tickets)
        .set({ status: "SERVING", calledAt: now })
        .where(eq(tickets.id, waiting[0].id))
        .returning();
      current = upd[0] ?? null;
    }

    return { skipped, current };
  });

  const snapshot = await getSnapshot();
  return {
    skipped: result.skipped ? toPublic(result.skipped) : null,
    current: result.current ? toPublic(result.current) : null,
    snapshot,
  };
}

/** Complete: SERVING -> DONE. */
export async function completeCurrent(loket: number) {
  assertLoket(loket);
  const bizDate = todayBizDate();
  const now = new Date();

  const serving = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.bizDate, bizDate),
        eq(tickets.loket, loket),
        eq(tickets.status, "SERVING")
      )
    )
    .limit(1);

  let done: TicketPublic | null = null;
  if (serving[0]) {
    const upd = await db
      .update(tickets)
      .set({ status: "DONE", finishedAt: now })
      .where(eq(tickets.id, serving[0].id))
      .returning();
    done = upd[0] ? toPublic(upd[0]) : null;
  }

  const snapshot = await getSnapshot();
  return { done, snapshot };
}

/** Arsip: list tiket per tanggal (default hari ini). Tidak ada delete. */
export async function getArchive(bizDate: string = todayBizDate(), loket?: number) {
  const rows = await db
    .select()
    .from(tickets)
    .where(
      loket === 1 || loket === 2
        ? and(eq(tickets.bizDate, bizDate), eq(tickets.loket, loket))
        : eq(tickets.bizDate, bizDate)
    )
    .orderBy(asc(tickets.number));
  return { date: bizDate, tickets: rows.map(toPublic), total: rows.length };
}
