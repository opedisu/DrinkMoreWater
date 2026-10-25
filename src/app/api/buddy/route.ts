import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { isBlocked, loadBuddies } from "@/lib/buddies";
import { awardBadges } from "@/lib/rewards";
import { rateLimit } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    return NextResponse.json({ buddyCode: user.buddy_code, buddies: await loadBuddies(user.id) });
}

/** Link to another user by their buddy code. */
export async function POST(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { code?: string };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const code = (payload.code ?? "").trim().toUpperCase();
    if (!/^[A-Z2-9]{4,12}$/.test(code)) {
        return NextResponse.json({ error: "That does not look like a buddy code." }, { status: 400 });
    }
    if (code === user.buddy_code) {
        return NextResponse.json({ error: "That is your own code." }, { status: 400 });
    }

    // Stops a stolen or guessed code being tried repeatedly.
    if (!(await rateLimit(`buddyadd:${user.id}`, 10, 3600))) {
        return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
    }

    const target = await queryOne<{ id: string; name: string }>(
        "SELECT id, name FROM users WHERE buddy_code = $1",
        [code]
    );
    if (!target) return NextResponse.json({ error: "No one found with that code." }, { status: 404 });

    // Someone who removed you as a follower cannot be followed again. The
    // message is deliberately the same as an unknown code.
    if (await isBlocked(target.id, user.id)) {
        return NextResponse.json({ error: "No one found with that code." }, { status: 404 });
    }

    const count = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM buddies WHERE user_id = $1",
        [user.id]
    );
    if (Number(count?.count ?? 0) >= 10) {
        return NextResponse.json({ error: "You can follow up to 10 buddies." }, { status: 400 });
    }

    await query(
        "INSERT INTO buddies (user_id, buddy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [user.id, target.id]
    );
    await awardBadges(user.id, ["buddy_up"]);
    await awardBadges(target.id, ["buddy_up"]);

    return NextResponse.json({ ok: true, name: target.name });
}

export async function DELETE(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const buddyId = new URL(request.url).searchParams.get("id");
    if (!buddyId) return NextResponse.json({ error: "Missing buddy id." }, { status: 400 });

    await query("DELETE FROM buddies WHERE user_id = $1 AND buddy_id = $2", [user.id, buddyId]);
    return NextResponse.json({ ok: true });
}
