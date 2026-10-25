import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { clearSessionCookie, currentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
    let payload: { everywhere?: boolean };
    try {
        payload = await request.json();
    } catch {
        payload = {};
    }

    // Signing out everywhere moves the validity cut-off forward, which kills
    // every session token issued before now -- on every device.
    if (payload.everywhere === true) {
        const user = await currentUser();
        if (user) {
            await query("UPDATE users SET sessions_valid_from = NOW() WHERE id = $1", [user.id]);
        }
    }

    await clearSessionCookie();
    return NextResponse.json({ ok: true });
}
