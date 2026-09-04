import { Elysia } from "elysia";
import { getSnapshot } from "../queue/service";
import {
  addClient,
  clientCount,
  removeClient,
  sendToOne,
  sseHeaders,
} from "../sse";
import { logger } from "../logger";

export const streamRoutes = new Elysia({ prefix: "/api" }).get(
  "/stream",
  async () => {
    // Snapshot diambil DULU dari DB supaya TV langsung dapat data terbaru
    // tanpa menunggu ada take/next.
    let initial;
    try {
      initial = await getSnapshot();
    } catch (err) {
      logger.error({ err }, "SSE initial snapshot failed");
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: "SNAPSHOT_FAILED" })}\n\n`,
        { status: 500, headers: sseHeaders() }
      );
    }

    const stream = new ReadableStream<string>({
      start(controller) {
        addClient(controller);
        // Event pertama: langsung snapshot terbaru.
        sendToOne(controller, "snapshot", initial);
        logger.info(
          { clients: clientCount() },
          "SSE client connected"
        );
      },
      cancel(controller) {
        removeClient(controller);
        logger.info({ clients: clientCount() }, "SSE client disconnected");
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  }
);
