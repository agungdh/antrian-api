import { Elysia } from "elysia";
import { logger } from "./logger";

const app = new Elysia().get("/", () => "Hello Elysia").listen(3000);

logger.info(
  {
    hostname: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia is running"
);
