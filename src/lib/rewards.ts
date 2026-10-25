import { query, queryOne } from "./db";
import { daysBetween } from "./time";
import { awardableCodes, XP_PER_GOAL, XP_PER_STREAK_DAY } from "./progression";
import type { User } from "./types";

export { XP_PER_LOG, levelFromXp, levelTitle } from "./progression";

export async function awardBadges(userId: string, codes: string[]): Promise<string[]> {
    const valid = codes.filter((code) => awardableCodes.has(code));
    if (valid.length === 0) return [];

    const rows = await query<{ code: string }>(
        `INSERT INTO badges (user_id, code)
         SELECT $1, UNNEST($2::text[])
         ON CONFLICT (user_id, code) DO NOTHING
         RETURNING code`,
        [userId, valid]
    );
    return rows.map((row) => row.code);
}

export async function listBadges(userId: string): Promise<{ code: string; earned_at: string }[]> {
    return query<{ code: string; earned_at: string }>(
        "SELECT code, earned_at FROM badges WHERE user_id = $1",
        [userId]
    );
}

export interface GoalReachedResult {
    firstTimeToday: boolean;
    streak: number;
    bestStreak: number;
    xpGained: number;
    newBadges: string[];
}

/**
 * Called when a log brings the user to (or past) their goal. Idempotent for
 * the day: extra drinks after the goal do not inflate the streak or XP.
 */
export async function registerGoalReached(
    user: User,
    today: string,
    minuteOfDay: number
): Promise<GoalReachedResult> {
    if (user.last_goal_date === today) {
        return {
            firstTimeToday: false,
            streak: user.streak_current,
            bestStreak: user.streak_best,
            xpGained: 0,
            newBadges: []
        };
    }

    const continuesStreak = user.last_goal_date !== null && daysBetween(user.last_goal_date, today) === 1;
    const streak = continuesStreak ? user.streak_current + 1 : 1;
    const bestStreak = Math.max(streak, user.streak_best);
    const xpGained = XP_PER_GOAL + Math.min(streak, 10) * XP_PER_STREAK_DAY;

    await query(
        `UPDATE users
         SET last_goal_date = $2, streak_current = $3, streak_best = $4, xp = xp + $5
         WHERE id = $1`,
        [user.id, today, streak, bestStreak, xpGained]
    );

    const earned = ["first_goal"];
    if (streak >= 3) earned.push("streak_3");
    if (streak >= 7) earned.push("streak_7");
    if (streak >= 30) earned.push("streak_30");
    if (streak >= 100) earned.push("streak_100");
    if (minuteOfDay < 18 * 60) earned.push("night_finisher");

    const newBadges = await awardBadges(user.id, earned);
    return { firstTimeToday: true, streak, bestStreak, xpGained, newBadges };
}

/**
 * A streak only survives if yesterday's goal was met. Checked on read so the
 * number shown is always honest, without needing a nightly job.
 */
export async function reconcileStreak(user: User, today: string): Promise<number> {
    if (user.streak_current === 0 || !user.last_goal_date) return 0;

    const gap = daysBetween(user.last_goal_date, today);
    if (gap <= 1) return user.streak_current;

    await query("UPDATE users SET streak_current = 0 WHERE id = $1", [user.id]);
    return 0;
}

export async function countLogs(userId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM intakes WHERE user_id = $1",
        [userId]
    );
    return Number(row?.count ?? 0);
}
