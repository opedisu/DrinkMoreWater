import { createHash, randomBytes } from "crypto";
import { query, queryOne } from "./db";
import { randomCode } from "./session";
import type { User } from "./types";

const TOKEN_TTL_MINUTES = 20;

export function normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

/** Returns the raw token to email. Only its hash is stored. */
export async function issueLoginToken(email: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await query(
        `INSERT INTO login_tokens (token_hash, email, expires_at)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL)`,
        [hashToken(token), email, String(TOKEN_TTL_MINUTES)]
    );
    return token;
}

/** Consumes a token (single use) and returns the email it was issued for. */
export async function consumeLoginToken(token: string): Promise<string | null> {
    const row = await queryOne<{ email: string }>(
        `UPDATE login_tokens
         SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING email`,
        [hashToken(token)]
    );
    return row?.email ?? null;
}

export async function findOrCreateUser(email: string, timezone: string): Promise<User> {
    const existing = await queryOne<User>("SELECT * FROM users WHERE email = $1", [email]);
    if (existing) return existing;

    // Retry on the (very unlikely) buddy code collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const created = await queryOne<User>(
            `INSERT INTO users (email, name, timezone, buddy_code)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (buddy_code) DO NOTHING
             RETURNING *`,
            [email, email.split("@")[0].slice(0, 40), timezone, randomCode()]
        );
        if (created) return created;
    }
    throw new Error("Could not create user.");
}

export async function cleanupExpiredTokens(): Promise<void> {
    await query("DELETE FROM login_tokens WHERE expires_at < NOW() - INTERVAL '1 day'");
}

/**
 * Fixed-window rate limiter backed by Postgres. Good enough at this scale and
 * avoids adding Redis for one feature.
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
    const row = await queryOne<{ count: number }>(
        `INSERT INTO rate_limits (bucket, count, window_at)
         VALUES ($1, 1, NOW())
         ON CONFLICT (bucket) DO UPDATE SET
             count = CASE
                 WHEN rate_limits.window_at < NOW() - ($2 || ' seconds')::INTERVAL THEN 1
                 ELSE rate_limits.count + 1
             END,
             window_at = CASE
                 WHEN rate_limits.window_at < NOW() - ($2 || ' seconds')::INTERVAL THEN NOW()
                 ELSE rate_limits.window_at
             END
         RETURNING count`,
        [bucket, String(windowSeconds)]
    );
    return (row?.count ?? 1) <= limit;
}
