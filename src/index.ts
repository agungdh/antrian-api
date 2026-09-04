import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { logger } from "./logger";
import { queueRoutes } from "./routes/queue";
import { streamRoutes } from "./routes/stream";

const app = new Elysia()
  .use(cors())
  .get("/", () => ({ service: "antrian-api", status: "ok" }))
  .get("/health", () => ({ status: "ok" }))
  .use(queueRoutes)
  .use(streamRoutes)
  .listen(3000);

logger.info(
  {
    hostname: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia is running"
);
