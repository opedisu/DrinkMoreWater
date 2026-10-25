import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { sendToUser } from "@/lib/push";
import { reminderMessage } from "@/lib/messages";
import { pacedTargetMl } from "@/lib/goal";
import { localDate, localMinuteOfDay } from "@/lib/time";
import type { Unit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CandidateRow {
    id: string;
    name: string;
    timezone: string;
    unit: Unit;
    goal_ml: number;
    smart_pacing: boolean;
    wake_minute: number;
    sleep_minute: number;
    interval_minutes: number;
    last_remind_at: string | null;
}

function authorised(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; GitHub Actions
    // and manual runs use the same header.
    const header = request.headers.get("authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("secret") ?? "";
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
    if (!authorised(request)) {
        return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    // Only users who actually have a device registered are worth considering.
    const candidates = await query<CandidateRow>(
        `SELECT DISTINCT u.id, u.name, u.timezone, u.unit, u.goal_ml, u.smart_pacing,
                u.wake_minute, u.sleep_minute, u.interval_minutes, u.last_remind_at
         FROM users u
         JOIN push_subscriptions p ON p.user_id = u.id
         WHERE u.reminders_on = TRUE`
    );

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    const reminded: string[] = [];

    for (const user of candidates) {
        const minuteOfDay = localMinuteOfDay(user.timezone, now);
        const today = localDate(user.timezone, now);

        // Outside their waking window -- never wake anyone up.
        if (minuteOfDay < user.wake_minute || minuteOfDay > user.sleep_minute) {
            skipped += 1;
            continue;
        }

        // Respect the chosen interval.
        if (user.last_remind_at) {
            const elapsedMinutes = (now.getTime() - new Date(user.last_remind_at).getTime()) / 60_000;
            // 2 minutes of slack so a cron that drifts slightly still fires.
            if (elapsedMinutes < user.interval_minutes - 2) {
                skipped += 1;
                continue;
            }
        }

        const totals = await query<{ total: string }>(
            "SELECT COALESCE(SUM(amount_ml), 0)::text AS total FROM intakes WHERE user_id = $1 AND local_date = $2",
            [user.id, today]
        );
        const totalMl = Number(totals[0]?.total ?? 0);

        // Already done for the day.
        if (totalMl >= user.goal_ml) {
            skipped += 1;
            continue;
        }

        const paced = pacedTargetMl(user.goal_ml, minuteOfDay, user.wake_minute, user.sleep_minute);
        const behind = totalMl < paced - 100;

        // Smart pacing: someone comfortably ahead of schedule gets left alone.
        if (user.smart_pacing && !behind && totalMl >= paced) {
            skipped += 1;
            continue;
        }

        const message = reminderMessage({
            name: user.name,
            remainingMl: user.goal_ml - totalMl,
            goalMl: user.goal_ml,
            unit: user.unit,
            behind
        });

        const delivered = await sendToUser(user.id, {
            ...message,
            tag: "dmw-reminder",
            url: "/app",
            quickAddMl: 250
        });

        if (delivered > 0) {
            await query("UPDATE users SET last_remind_at = NOW() WHERE id = $1", [user.id]);
            sent += 1;
            reminded.push(user.id);
        }
    }

    return NextResponse.json({
        ok: true,
        ranAt: now.toISOString(),
        considered: candidates.length,
        sent,
        skipped,
        reminded
    });
}

// Vercel Cron issues GET; POST is accepted so other schedulers can be used too.
export const POST = GET;
