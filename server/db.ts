import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Strip sslmode from URL and pass SSL config explicitly to avoid pg v9 sslmode=verify-full behavior
const rawUrl = process.env.DATABASE_URL!;
const cleanUrl = rawUrl.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '');

export const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
