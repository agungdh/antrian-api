import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { logger } from "./logger";
import { queueRoutes } from "./routes/queue";
import { streamRoutes } from "./routes/stream";

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: { title: "Antrian API", version: "1.0.0" },
      },
    })
  )
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
