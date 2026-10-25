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

/** Token format: <userId>.<issuedAtEpochSeconds>.<expiryEpochSeconds>.<hmac> */
export function createSessionToken(userId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiry = issuedAt + SESSION_DAYS * 86_400;
    const payload = `${userId}.${issuedAt}.${expiry}`;
    return `${payload}.${sign(payload)}`;
}

export interface SessionClaims {
    userId: string;
    issuedAt: number;
}

export function verifySessionToken(token: string): SessionClaims | null {
    const parts = token.split(".");
    if (parts.length !== 4) return null;

    const [userId, issuedAt, expiry, signature] = parts;
    const expected = Buffer.from(sign(`${userId}.${issuedAt}.${expiry}`));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    if (Number(expiry) * 1000 < Date.now()) return null;
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(issuedAt)) return null;

    return { userId, issuedAt: Number(issuedAt) };
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

async function sessionClaims(): Promise<SessionClaims | null> {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}

export async function currentUser(): Promise<User | null> {
    const claims = await sessionClaims();
    if (!claims) return null;

    const user = await queryOne<User>("SELECT * FROM users WHERE id = $1", [claims.userId]);
    if (!user) return null;

    // A token issued before the user last signed out everywhere is dead, even
    // though its signature and expiry are still valid.
    const validFrom = Math.floor(new Date(user.sessions_valid_from).getTime() / 1000);
    if (claims.issuedAt < validFrom) return null;

    return user;
}

/** Cheap check for pages that only need to know whether someone is signed in. */
export async function currentUserId(): Promise<string | null> {
    return (await currentUser())?.id ?? null;
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
