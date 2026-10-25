import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

interface SubscribePayload {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: SubscribePayload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { endpoint, keys } = payload;
    if (!endpoint || !endpoint.startsWith("https://") || !keys?.p256dh || !keys.auth) {
        return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    // One row per browser endpoint. Re-subscribing moves it to this user.
    await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent`,
        [user.id, endpoint, keys.p256dh, keys.auth, (request.headers.get("user-agent") ?? "").slice(0, 300)]
    );

    await query("UPDATE users SET reminders_on = TRUE WHERE id = $1", [user.id]);

    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { endpoint?: string };
    try {
        payload = await request.json();
    } catch {
        payload = {};
    }

    if (payload.endpoint) {
        await query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [user.id, payload.endpoint]);
    } else {
        await query("DELETE FROM push_subscriptions WHERE user_id = $1", [user.id]);
    }

    return NextResponse.json({ ok: true });
}
