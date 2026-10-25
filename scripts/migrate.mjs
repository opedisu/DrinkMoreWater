#!/usr/bin/env node
/* Applies db/schema.sql. Safe to run repeatedly. */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env.mjs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnvLocal();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not set, and no .env.local was found.");
    console.error("Run `npm run setup` first, or export DATABASE_URL yourself.");
    process.exit(1);
}

const sql = await readFile(join(here, "..", "db", "schema.sql"), "utf8");
const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: false }
});

await client.connect();
try {
    await client.query(sql);
    console.log("Schema applied.");
} finally {
    await client.end();
}
