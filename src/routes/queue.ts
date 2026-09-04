import { Elysia, t } from "elysia";
import { broadcast } from "../sse";
import { logger } from "../logger";
import {
  callNext,
  completeCurrent,
  getArchive,
  getSnapshot,
  recallCurrent,
  skipCurrent,
  takeTicket,
} from "../queue/service";

function parseLoketParam(id: string): number {
  const n = Number(id);
  if (n !== 1 && n !== 2) throw new Error("LOKET_INVALID");
  return n;
}

export const queueRoutes = new Elysia({ prefix: "/api" })
  .onError(({ error, set }) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "LOKET_INVALID") {
      set.status = 400;
      return { error: "LOKET_INVALID", message: "loket harus 1 atau 2" };
    }
    if (msg === "QUOTA_FULL") {
      set.status = 409;
      return {
        error: "QUOTA_FULL",
        message: "Kuota 1000/hari per loket sudah penuh",
      };
    }
    // Error validasi body/query dari Elysia (mis. loket: 3) -> 400, bukan 500.
    if (set.status === 422 || (error as { type?: string })?.type === "validation") {
      set.status = 400;
      return { error: "VALIDATION", message: "Request tidak valid" };
    }
    logger.error({ err: msg }, "queue route error");
    set.status = 500;
    return { error: "INTERNAL", message: "Terjadi kesalahan" };
  })

  // Kios: ambil nomor baru
  .post(
    "/tickets",
    async ({ body, set }) => {
      const { ticket, position, snapshot } = await takeTicket(body.loket);
      broadcast("created", { loket: ticket.loket, ticket });
      broadcast("snapshot", snapshot);
      set.status = 201;
      return { ticket, position };
    },
    { body: t.Object({ loket: t.Union([t.Literal(1), t.Literal(2)]) }) }
  )

  // Display/kios: snapshot hari ini
  .get("/queue", async () => {
    return await getSnapshot();
  })

  // Arsip (read-only, tidak ada delete)
  .get(
    "/archive",
    async ({ query }) => {
      const loket =
        query.loket === "1" ? 1 : query.loket === "2" ? 2 : undefined;
      return await getArchive(query.date, loket);
    },
    { query: t.Object({ date: t.Optional(t.String()), loket: t.Optional(t.String()) }) }
  )

  // Admin: panggil berikutnya (DONE-kan lama, SERVING-kan waiting terkecil)
  .post("/loket/:id/next", async ({ params }) => {
    const loket = parseLoketParam(params.id);
    const { finished, current, snapshot } = await callNext(loket);
    if (current) broadcast("called", { loket, ticket: current });
    broadcast("snapshot", snapshot);
    return { finished, current };
  })

  // Admin: panggil ulang (FE bunyi lagi, called_at di-refresh)
  .post("/loket/:id/recall", async ({ params, set }) => {
    const loket = parseLoketParam(params.id);
    const { current, snapshot } = await recallCurrent(loket);
    if (!current) {
      set.status = 404;
      return { error: "EMPTY", message: "Tidak ada yang sedang dilayani" };
    }
    broadcast("recalled", { loket, ticket: current });
    broadcast("snapshot", snapshot);
    return { current };
  })

  // Admin: skip (SERVING -> SKIPPED, langsung naikkan berikutnya)
  .post("/loket/:id/skip", async ({ params }) => {
    const loket = parseLoketParam(params.id);
    const { skipped, current, snapshot } = await skipCurrent(loket);
    if (skipped) broadcast("skipped", { loket, ticket: skipped });
    if (current) broadcast("called", { loket, ticket: current });
    broadcast("snapshot", snapshot);
    return { skipped, current };
  })

  // Admin: selesaikan (SERVING -> DONE)
  .post("/loket/:id/complete", async ({ params }) => {
    const loket = parseLoketParam(params.id);
    const { done, snapshot } = await completeCurrent(loket);
    if (done) broadcast("completed", { loket, ticket: done });
    broadcast("snapshot", snapshot);
    return { done };
  });
