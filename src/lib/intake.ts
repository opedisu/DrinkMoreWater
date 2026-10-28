import { query, queryOne } from "./db";
import { localDate, localMinuteOfDay } from "./time";
import { awardBadges, countLogs, registerGoalReached } from "./rewards";
import { levelFromXp, XP_PER_LOG } from "./progression";
import { excessiveThresholdMl } from "./goal";
import { notifyFollowersOfGoal } from "./buddies";
import type { User } from "./types";

export const MAX_SINGLE_ML = 3000;

export interface IntakeResult {
    ok: true;
    intake: { id: string; amountMl: number; drink: string; createdAt: string };
    totalMl: number;
    goalMl: number;
    justHitGoal: boolean;
    streakRepaired: boolean;
    excessive: boolean;
    newBadges: string[];
    rewards: {
        xp: number;
        streakCurrent: number;
        streakBest: number;
        level: number;
        intoLevel: number;
        levelSpan: number;
    };
}

/**
 * Records a drink and applies every reward side effect it triggers.
 *
 * atMinute backdates the entry to a time earlier today, for the glass you
 * drank but forgot to log. It stays on today's date, so the day's total and
 * every streak rule are untouched; only the clock time moves.
 */
export async function recordIntake(
    user: User,
    amountMl: number,
    drink: string,
    atMinute: number | null = null
): Promise<IntakeResult> {
    const today = localDate(user.timezone);
    const nowMinute = localMinuteOfDay(user.timezone);

    // Both minutes are read from the same instant in the same zone, so the
    // difference between them is exact without any date arithmetic.
    const minuteOfDay = atMinute ?? nowMinute;
    const createdAt =
        atMinute === null ? null : new Date(Date.now() - (nowMinute - atMinute) * 60_000);

    const inserted = await queryOne<{ id: string; created_at: string }>(
        `INSERT INTO intakes (user_id, amount_ml, local_date, drink, created_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
         RETURNING id, created_at`,
        [user.id, amountMl, today, drink, createdAt]
    );

    await query("UPDATE users SET xp = xp + $2 WHERE id = $1", [user.id, XP_PER_LOG]);

    const totals = await queryOne<{ total: string }>(
        "SELECT COALESCE(SUM(amount_ml), 0)::text AS total FROM intakes WHERE user_id = $1 AND local_date = $2",
        [user.id, today]
    );
    const totalMl = Number(totals?.total ?? 0);

    const earned = ["first_sip"];
    if (minuteOfDay < 8 * 60) earned.push("early_bird");

    const logCount = await countLogs(user.id);
    if (logCount >= 50) earned.push("logs_50");
    if (logCount >= 250) earned.push("logs_250");
    const newBadges = await awardBadges(user.id, earned);

    const goalReached = totalMl >= user.goal_ml ? await registerGoalReached(user, today, minuteOfDay) : null;

    if (goalReached?.firstTimeToday) {
        // Best effort: a push failure must never fail the log itself.
        await notifyFollowersOfGoal(user, goalReached.streak).catch((error) =>
            console.error("buddy goal notification failed:", error)
        );
    }

    const refreshed = await queryOne<{ xp: number; streak_current: number; streak_best: number }>(
        "SELECT xp, streak_current, streak_best FROM users WHERE id = $1",
        [user.id]
    );
    const xp = refreshed?.xp ?? user.xp;

    return {
        ok: true,
        intake: {
            id: inserted?.id ?? "",
            amountMl,
            drink,
            createdAt: inserted?.created_at ?? new Date().toISOString()
        },
        totalMl,
        goalMl: user.goal_ml,
        justHitGoal: goalReached?.firstTimeToday ?? false,
        streakRepaired: goalReached?.streakRepaired ?? false,
        excessive: totalMl > excessiveThresholdMl(user.goal_ml),
        newBadges: [...newBadges, ...(goalReached?.newBadges ?? [])],
        rewards: {
            xp,
            streakCurrent: refreshed?.streak_current ?? user.streak_current,
            streakBest: refreshed?.streak_best ?? user.streak_best,
            ...levelFromXp(xp)
        }
    };
}

export function parseAmountMl(value: unknown): number | null {
    const amountMl = Math.round(Number(value));
    if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > MAX_SINGLE_ML) return null;
    return amountMl;
}
