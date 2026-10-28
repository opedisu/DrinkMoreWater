import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { localDate, localMinuteOfDay } from "@/lib/time";
import { XP_PER_LOG } from "@/lib/progression";
import { revokeGoalIfLost } from "@/lib/rewards";
import { MAX_SINGLE_ML, parseAmountMl, recordIntake } from "@/lib/intake";
import { ALLOWED_DRINKS, HYDRATING_SUM_SQL } from "@/lib/drinks";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: { amountMl?: number; drink?: string; atMinute?: number | null };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const amountMl = parseAmountMl(payload.amountMl);
    if (amountMl === null) {
        return NextResponse.json({ error: `Amount must be between 1 and ${MAX_SINGLE_ML} ml.` }, { status: 400 });
    }

    // A backdated entry may only be moved to an earlier point of today. Later
    // today has not happened, and an earlier day would rewrite a settled
    // total that streaks and badges have already been decided on.
    let atMinute: number | null = null;
    if (payload.atMinute !== undefined && payload.atMinute !== null) {
        atMinute = Math.round(Number(payload.atMinute));
        if (!Number.isInteger(atMinute) || atMinute < 0 || atMinute > 1439) {
            return NextResponse.json({ error: "That is not a time of day." }, { status: 400 });
        }
        if (atMinute > localMinuteOfDay(user.timezone)) {
            return NextResponse.json({ error: "That time has not come round yet today." }, { status: 400 });
        }
    }

    const drink = ALLOWED_DRINKS.has(payload.drink ?? "") ? (payload.drink as string) : "water";
    return NextResponse.json(await recordIntake(user, amountMl, drink, atMinute));
}

/** Undo: removes a specific log, or the most recent one for today. */
export async function DELETE(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    const today = localDate(user.timezone);

    const deleted = id
        ? await queryOne<{ id: string }>(
              "DELETE FROM intakes WHERE id = $1 AND user_id = $2 RETURNING id",
              [id, user.id]
          )
        : await queryOne<{ id: string }>(
              `DELETE FROM intakes
               WHERE id = (
                   SELECT id FROM intakes
                   WHERE user_id = $1 AND local_date = $2
                   ORDER BY created_at DESC
                   LIMIT 1
               )
               RETURNING id`,
              [user.id, today]
          );

    if (!deleted) return NextResponse.json({ error: "Nothing to undo." }, { status: 404 });

    // Reclaim the log XP, never below zero.
    await query("UPDATE users SET xp = GREATEST(0, xp - $2) WHERE id = $1", [user.id, XP_PER_LOG]);

    const totals = await queryOne<{ total: string }>(
        `SELECT ${HYDRATING_SUM_SQL}::text AS total FROM intakes WHERE user_id = $1 AND local_date = $2`,
        [user.id, today]
    );
    const totalMl = Number(totals?.total ?? 0);

    const goalLost = await revokeGoalIfLost(user, today, totalMl);

    return NextResponse.json({ ok: true, totalMl, goalLost });
}
