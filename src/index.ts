import { Elysia } from "elysia";
import { logger } from "./logger";

const app = new Elysia()
  .onRequest(({ request }) => {
    (request as any)._startTime = Date.now();
  })
  .onAfterHandle(({ request, set }) => {
    const start = (request as any)._startTime ?? Date.now();
    logger.info(
      {
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status ?? 200,
        durationMs: Date.now() - start,
      },
      "request completed"
    );
  })
  .onError(({ request, error, set }) => {
    const start = (request as any)?._startTime ?? Date.now();
    const status =
      (error as any)?.status ?? (set.status as number | undefined) ?? 500;
    logger.error(
      {
        method: request?.method,
        path: request ? new URL(request.url).pathname : undefined,
        status,
        durationMs: Date.now() - start,
        err: error,
      },
      "request failed"
    );
  })
  .get("/", () => "Hello Elysia")
  .listen(3000);

logger.info(
  {
    hostname: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia is running"
);
