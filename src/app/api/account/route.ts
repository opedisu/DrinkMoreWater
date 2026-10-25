import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { clearSessionCookie, currentUser } from "@/lib/session";
import { buildSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";

/** Everything we hold on this user, as a downloadable JSON file. */
export async function GET(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const [snapshot, intakes] = await Promise.all([
        buildSnapshot(user),
        query("SELECT amount_ml, drink, local_date::text AS local_date, created_at FROM intakes WHERE user_id = $1 ORDER BY created_at", [user.id])
    ]);

    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot, intakes }, null, 2), {
        headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="drinkmorewater-export.json"`
        }
    });
}

/**
 * Deletes the account. Intakes, badges, buddy links and push subscriptions all
 * cascade from the users row, so this leaves nothing behind.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { confirm?: string };
    try {
        payload = await request.json();
    } catch {
        payload = {};
    }

    // Typing the email makes an accidental or spoofed delete much harder.
    if (payload.confirm?.trim().toLowerCase() !== user.email) {
        return NextResponse.json({ error: "Type your email address to confirm." }, { status: 400 });
    }

    await query("DELETE FROM users WHERE id = $1", [user.id]);
    await clearSessionCookie();

    return NextResponse.json({ ok: true });
}
