import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://admin:admin@127.0.0.1:5432/antrian";

export const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
