import { query, queryOne } from "./db";
import { localDate, localMinuteOfDay } from "./time";
import { awardBadges, countLogs, registerGoalReached } from "./rewards";
import { levelFromXp, XP_PER_LOG } from "./progression";
import { excessiveThresholdMl } from "./goal";
import { notifyFollowersOfGoal } from "./buddies";
import type { User } from "./types";

export const MAX_SINGLE_ML = 3000;
export const ALLOWED_DRINKS = new Set(["water", "sparkling", "tea", "coffee", "juice", "other"]);

export interface IntakeResult {
    ok: true;
    intake: { id: string; amountMl: number; drink: string; createdAt: string };
    totalMl: number;
    goalMl: number;
    justHitGoal: boolean;
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

/** Records a drink and applies every reward side effect it triggers. */
export async function recordIntake(user: User, amountMl: number, drink: string): Promise<IntakeResult> {
    const today = localDate(user.timezone);
    const minuteOfDay = localMinuteOfDay(user.timezone);

    const inserted = await queryOne<{ id: string; created_at: string }>(
        `INSERT INTO intakes (user_id, amount_ml, local_date, drink)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [user.id, amountMl, today, drink]
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
