import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { sendToUser } from "@/lib/push";
import { rateLimit } from "@/lib/auth";

export const runtime = "nodejs";

const PRESETS = [
    "sent you a nudge 💧",
    "says: drink some water! 🚰",
    "is cheering you on 💞",
    "bets you can hit your goal today 🎯"
];

export async function POST(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { buddyId?: string; message?: string };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const buddyId = payload.buddyId ?? "";
    if (!/^\d+$/.test(buddyId)) {
        return NextResponse.json({ error: "Missing buddy id." }, { status: 400 });
    }

    // Only a linked buddy can nudge, and no more than 6 nudges an hour --
    // this is an affection feature, not a notification cannon.
    const link = await queryOne<{ buddy_id: string }>(
        "SELECT buddy_id FROM buddies WHERE user_id = $1 AND buddy_id = $2",
        [user.id, buddyId]
    );
    if (!link) return NextResponse.json({ error: "Not one of your buddies." }, { status: 403 });

    if (!(await rateLimit(`nudge:${user.id}:${buddyId}`, 6, 3600))) {
        return NextResponse.json({ error: "You have sent plenty of nudges this hour." }, { status: 429 });
    }

    const custom = (payload.message ?? "").trim().slice(0, 120);
    const body = custom.length > 0 ? custom : PRESETS[Math.floor(Math.random() * PRESETS.length)];
    const from = user.name || "Your buddy";

    const sent = await sendToUser(buddyId, {
        title: `${from} ${custom.length > 0 ? "says:" : ""}`.trim(),
        body,
        tag: `dmw-nudge-${user.id}`,
        url: "/app",
        quickAddMl: 250
    });

    if (sent === 0) {
        return NextResponse.json({ error: "They have not enabled reminders on any device yet." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
