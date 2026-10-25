import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { queryOne } from "./db";
import type { User } from "./types";

const COOKIE_NAME = "dmw_session";
const SESSION_DAYS = 90;

function secret(): string {
    const value = process.env.AUTH_SECRET;
    if (!value || value.length < 32) {
        throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
    }
    return value;
}

function sign(payload: string): string {
    return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Token format: <userId>.<expiryEpochSeconds>.<hmac> */
export function createSessionToken(userId: string): string {
    const expiry = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
    const payload = `${userId}.${expiry}`;
    return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [userId, expiry, signature] = parts;
    const expected = Buffer.from(sign(`${userId}.${expiry}`));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    if (Number(expiry) * 1000 < Date.now()) return null;
    if (!/^\d+$/.test(userId)) return null;

    return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
    const store = await cookies();
    store.set(COOKIE_NAME, createSessionToken(userId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DAYS * 86_400
    });
}

export async function clearSessionCookie(): Promise<void> {
    const store = await cookies();
    store.delete(COOKIE_NAME);
}

export async function currentUserId(): Promise<string | null> {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}

export async function currentUser(): Promise<User | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    return queryOne<User>("SELECT * FROM users WHERE id = $1", [userId]);
}

export function randomCode(bytes = 4): string {
    // Unambiguous alphabet: no 0/O/1/I to keep spoken codes workable.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const raw = randomBytes(bytes * 2);
    let out = "";
    for (let i = 0; i < bytes * 2; i += 1) {
        out += alphabet[raw[i] % alphabet.length];
    }
    return out;
}
