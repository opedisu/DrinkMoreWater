import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { isValidTimezone } from "@/lib/time";
import { buildSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    return NextResponse.json(await buildSnapshot(user));
}

/** Used once, right after sign-in, to adopt the browser's timezone. */
export async function PATCH(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { timezone?: string };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const timezone = payload.timezone ?? "";
    if (user.timezone === "UTC" && isValidTimezone(timezone)) {
        await query("UPDATE users SET timezone = $2 WHERE id = $1", [user.id, timezone]);
        return NextResponse.json({ ok: true, timezone });
    }
    return NextResponse.json({ ok: true, timezone: user.timezone });
}
