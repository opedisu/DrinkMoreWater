import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { sendToUser } from "@/lib/push";
import { reminderMessage } from "@/lib/messages";
import { pacedTargetMl } from "@/lib/goal";
import { localMinuteOfDay } from "@/lib/time";
import type { Unit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How many users are pushed at once. Keeps the sweep fast without stampeding. */
const CONCURRENCY = 10;

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
    today_ml: string;
}

function authorised(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    // Header only. A secret in the query string ends up in access logs,
    // browser history and referrer headers.
    const header = request.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ")) return false;

    const provided = Buffer.from(header.slice(7));
    const expected = Buffer.from(secret);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request): Promise<NextResponse> {
    if (!authorised(request)) {
        return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const now = new Date();

    // One query for everything the sweep needs. Today's total is joined in per
    // user rather than fetched in a loop, so the cost does not grow with the
    // number of users the way an N+1 would.
    const candidates = await query<CandidateRow>(
        `SELECT u.id, u.name, u.timezone, u.unit, u.goal_ml, u.smart_pacing,
                u.wake_minute, u.sleep_minute, u.interval_minutes, u.last_remind_at,
                COALESCE(i.total, 0)::text AS today_ml
         FROM users u
         LEFT JOIN LATERAL (
             SELECT SUM(amount_ml) AS total
             FROM intakes
             WHERE user_id = u.id
               AND local_date = (NOW() AT TIME ZONE u.timezone)::date
         ) i ON TRUE
         WHERE u.reminders_on = TRUE
           AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id)`
    );

    const due: CandidateRow[] = [];
    let skipped = 0;

    for (const user of candidates) {
        const minuteOfDay = localMinuteOfDay(user.timezone, now);
        const totalMl = Number(user.today_ml);

        // Outside their waking window -- never wake anyone up.
        if (minuteOfDay < user.wake_minute || minuteOfDay > user.sleep_minute) {
            skipped += 1;
            continue;
        }

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

        due.push(user);
    }

    let sent = 0;
    const reminded: string[] = [];

    // Work through the due list a slice at a time.
    for (let offset = 0; offset < due.length; offset += CONCURRENCY) {
        const slice = due.slice(offset, offset + CONCURRENCY);

        await Promise.all(
            slice.map(async (user) => {
                // Claim the reminder atomically. If two sweeps overlap -- or a
                // slow run is still going when the next starts -- only one of
                // them wins this UPDATE, so nobody is pushed twice.
                const claim = await query<{ id: string }>(
                    `UPDATE users
                     SET last_remind_at = NOW()
                     WHERE id = $1
                       AND (
                           last_remind_at IS NULL
                           OR last_remind_at < NOW() - (($2::int - 2) || ' minutes')::INTERVAL
                       )
                     RETURNING id`,
                    [user.id, user.interval_minutes]
                );

                if (claim.length === 0) {
                    skipped += 1;
                    return;
                }

                const totalMl = Number(user.today_ml);
                const minuteOfDay = localMinuteOfDay(user.timezone, now);
                const paced = pacedTargetMl(user.goal_ml, minuteOfDay, user.wake_minute, user.sleep_minute);

                const message = reminderMessage({
                    name: user.name,
                    remainingMl: user.goal_ml - totalMl,
                    goalMl: user.goal_ml,
                    unit: user.unit,
                    behind: totalMl < paced - 100
                });

                const delivered = await sendToUser(user.id, {
                    ...message,
                    tag: "dmw-reminder",
                    url: "/app",
                    quickAddMl: 250
                });

                if (delivered > 0) {
                    sent += 1;
                    reminded.push(user.id);
                } else {
                    // Nothing went out, so release the claim and let the next
                    // sweep try again rather than waiting a full interval.
                    await query("UPDATE users SET last_remind_at = $2 WHERE id = $1", [
                        user.id,
                        user.last_remind_at
                    ]);
                }
            })
        );
    }

    // Recorded so /api/health can tell an uptime monitor the scheduler is
    // still alive. This is what turns a silent failure into an alert.
    await query(
        `INSERT INTO system_state (key, value, updated_at)
         VALUES ('last_sweep', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [now.toISOString()]
    );

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
