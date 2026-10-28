import { query } from "./db";
import { HYDRATING_SUM_SQL } from "./drinks";
import { sendToUser } from "./push";
import { digestMessage } from "./messages";
import { isAwakeAt } from "./goal";
import { localMinuteOfDay } from "./time";
import type { Unit } from "./types";

/**
 * The weekly digest: one push on a Sunday evening saying how the week went.
 *
 * It rides along with the reminder sweep rather than having a schedule of its
 * own, because the sweep already runs every fifteen minutes and already knows
 * how to reach everyone. The whole job is deciding who is due.
 */

/** Evening in the reader's own zone, pulled earlier for an early sleeper. */
const DIGEST_MINUTE = 19 * 60;

interface DigestRow {
    id: string;
    name: string;
    timezone: string;
    unit: Unit;
    goal_ml: number;
    streak_current: number;
    wake_minute: number;
    sleep_minute: number;
    goal_days: string;
    total_ml: string;
}

export async function sendWeeklyDigests(now: Date): Promise<{ sent: number; due: number }> {
    // Sunday, not yet sent for that local date, and the seven days ending
    // today rolled up in the same pass so the cost does not grow per user.
    const candidates = await query<DigestRow>(
        `SELECT u.id, u.name, u.timezone, u.unit, u.goal_ml, u.streak_current,
                u.wake_minute, u.sleep_minute,
                COALESCE(w.goal_days, 0)::text AS goal_days,
                COALESCE(w.total_ml, 0)::text AS total_ml
         FROM users u
         LEFT JOIN LATERAL (
             SELECT COUNT(*) FILTER (WHERE d.total >= u.goal_ml) AS goal_days,
                    SUM(d.total) AS total_ml
             FROM (
                 SELECT local_date, ${HYDRATING_SUM_SQL} AS total
                 FROM intakes
                 WHERE user_id = u.id
                   AND local_date > (NOW() AT TIME ZONE u.timezone)::date - 7
                   AND local_date <= (NOW() AT TIME ZONE u.timezone)::date
                 GROUP BY local_date
             ) d
         ) w ON TRUE
         WHERE u.reminders_on = TRUE
           AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id)
           AND EXTRACT(DOW FROM (NOW() AT TIME ZONE u.timezone)) = 0
           AND (
               u.last_digest_on IS NULL
               OR u.last_digest_on < (NOW() AT TIME ZONE u.timezone)::date
           )`
    );

    let sent = 0;
    let due = 0;

    for (const user of candidates) {
        const minuteOfDay = localMinuteOfDay(user.timezone, now);

        // Someone who is in bed before seven gets theirs earlier rather than
        // never. Only for a window that ends the same day: when it wraps past
        // midnight, sleep_minute is a small hour of the morning, and taking an
        // hour off it would send the digest at breakfast.
        const wrapsPastMidnight = user.sleep_minute <= user.wake_minute;
        const sendAt = wrapsPastMidnight
            ? DIGEST_MINUTE
            : Math.min(DIGEST_MINUTE, user.sleep_minute - 60);

        if (minuteOfDay < sendAt) continue;
        if (!isAwakeAt(minuteOfDay, user.wake_minute, user.sleep_minute)) continue;

        due += 1;

        // Claim it first. Two overlapping sweeps would otherwise both send.
        const claim = await query<{ id: string }>(
            `UPDATE users
             SET last_digest_on = (NOW() AT TIME ZONE timezone)::date
             WHERE id = $1
               AND (
                   last_digest_on IS NULL
                   OR last_digest_on < (NOW() AT TIME ZONE timezone)::date
               )
             RETURNING id`,
            [user.id]
        );
        if (claim.length === 0) continue;

        const message = digestMessage({
            goalDays: Number(user.goal_days),
            totalMl: Number(user.total_ml),
            streak: user.streak_current,
            unit: user.unit
        });

        const delivered = await sendToUser(user.id, {
            ...message,
            tag: "dmw-digest",
            url: "/progress",
            quickAddMl: 250
        });

        if (delivered > 0) {
            sent += 1;
        } else {
            // Nothing reached a device, so let next Sunday's sweep try again
            // rather than counting a digest nobody saw.
            await query("UPDATE users SET last_digest_on = NULL WHERE id = $1", [user.id]);
        }
    }

    return { sent, due };
}
