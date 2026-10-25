import { Pool, types, type QueryResultRow } from "pg";

// Postgres DATE columns arrive as JS Date objects by default, which silently
// shifts the day when the server timezone differs from the user's. Every date
// in this app is a plain YYYY-MM-DD string in the user's own timezone, so keep
// them as strings. 1082 = DATE.
types.setTypeParser(1082, (value: string) => value);

// Serverless functions are recycled constantly, so the pool is cached on the
// global object to avoid opening a new connection on every invocation.
const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool(): Pool {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }

    return new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        ssl: sslConfig(connectionString)
    });
}

/**
 * Certificates are verified by default. Neon, Supabase and Railway all present
 * publicly trusted certs, so this works out of the box. Set
 * DATABASE_SSL_NO_VERIFY=true only for a provider with a self-signed cert, and
 * understand that it removes protection against an intercepted connection.
 */
function sslConfig(connectionString: string): false | { rejectUnauthorized: boolean; ca?: string } {
    if (connectionString.includes("localhost") || connectionString.includes("sslmode=disable")) {
        return false;
    }
    if (process.env.DATABASE_SSL_CA) {
        return { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA };
    }
    if (process.env.DATABASE_SSL_NO_VERIFY === "true") {
        console.warn("DATABASE_SSL_NO_VERIFY is set -- the database connection is not authenticated.");
        return { rejectUnauthorized: false };
    }
    return { rejectUnauthorized: true };
}

export function pool(): Pool {
    if (!globalForDb.pool) {
        globalForDb.pool = createPool();
    }
    return globalForDb.pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await pool().query<T>(text, params);
    return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
}
