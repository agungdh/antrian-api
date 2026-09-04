import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia, file } from "elysia";
import { logger } from "./logger";
import { queueRoutes } from "./routes/queue";
import { streamRoutes } from "./routes/stream";

// Folder hasil build FE (di-copy pas CICD ke ./public).
// Contoh CICD: cp -r fe-dist/* ./public/
const PUBLIC_DIR = "public";

async function serveIndex({ set }: { set: { status?: number | string } }) {
  if (await Bun.file(`${PUBLIC_DIR}/index.html`).exists())
    return file(`${PUBLIC_DIR}/index.html`);
  set.status = 404;
  return {
    error: "FE_NOT_BUILT",
    message: "public/index.html belum ada, copy hasil build FE ke folder public/",
  };
}

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
  .get("/health", () => ({ status: "ok" }))
  .use(queueRoutes)
  .use(streamRoutes)
  // FE static build: / -> public/index.html, assets -> public/*,
  // SPA fallback -> index.html (kecuali /api, /health, /swagger).
  .get("/", serveIndex)
  .get("/*", async ({ path, set }) => {
    if (
      path.startsWith("/api") ||
      path.startsWith("/swagger") ||
      path === "/health"
    ) {
      set.status = 404;
      return { error: "NOT_FOUND" };
    }
    const rel = path.slice(1).split("?")[0];
    if (rel.includes("..")) {
      set.status = 400;
      return { error: "BAD_PATH" };
    }
    if (rel) {
      if (await Bun.file(`${PUBLIC_DIR}/${rel}`).exists())
        return file(`${PUBLIC_DIR}/${rel}`);
    }
    return serveIndex({ set });
  })
  .listen(3000);

logger.info(
  {
    hostname: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia is running"
);
