import { query, queryOne } from "./db";
import { HYDRATING_SUM_SQL } from "./drinks";
import { daysBetween } from "./time";
import { awardableCodes, XP_PER_GOAL, XP_PER_STREAK_DAY } from "./progression";
import { streakAfterGoal, streakSurvives } from "./streak";
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
    /** A missed day was forgiven to keep this streak alive. */
    streakRepaired: boolean;
}

/** Days since the last repair, or null if this user has never had one. */
function graceAge(user: User, today: string): number | null {
    return user.streak_grace_at === null ? null : daysBetween(user.streak_grace_at, today);
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
            newBadges: [],
            streakRepaired: false
        };
    }

    const { streak, repaired } =
        user.last_goal_date === null
            ? { streak: 1, repaired: false }
            : streakAfterGoal(
                  user.streak_current,
                  daysBetween(user.last_goal_date, today),
                  graceAge(user, today)
              );

    const bestStreak = Math.max(streak, user.streak_best);
    const xpGained = XP_PER_GOAL + Math.min(streak, 10) * XP_PER_STREAK_DAY;

    // The WHERE clause is the real guard: if two logs cross the goal at the
    // same moment, only one of them updates, so XP is never granted twice and
    // buddies are only told once. COALESCE leaves the repair date alone unless
    // this goal actually spent one.
    const claimed = await queryOne<{ id: string }>(
        `UPDATE users
         SET last_goal_date = $2, streak_current = $3, streak_best = $4, xp = xp + $5,
             streak_grace_at = COALESCE($6, streak_grace_at)
         WHERE id = $1 AND last_goal_date IS DISTINCT FROM $2
         RETURNING id`,
        [user.id, today, streak, bestStreak, xpGained, repaired ? today : null]
    );

    if (!claimed) {
        return {
            firstTimeToday: false,
            streak,
            bestStreak,
            xpGained: 0,
            newBadges: [],
            streakRepaired: false
        };
    }

    const earned = ["first_goal"];
    if (streak >= 3) earned.push("streak_3");
    if (streak >= 7) earned.push("streak_7");
    if (streak >= 30) earned.push("streak_30");
    if (streak >= 100) earned.push("streak_100");
    if (minuteOfDay < 18 * 60) earned.push("night_finisher");

    const newBadges = await awardBadges(user.id, earned);
    return { firstTimeToday: true, streak, bestStreak, xpGained, newBadges, streakRepaired: repaired };
}

/**
 * A streak only survives if yesterday's goal was met, or if one missed day
 * can still be forgiven. Checked on read so the number shown is always
 * honest, without needing a nightly job.
 *
 * The repair is not spent here. Today may still end without a goal, and then
 * tomorrow's gap is past saving anyway.
 */
export async function reconcileStreak(user: User, today: string): Promise<number> {
    if (user.streak_current === 0 || !user.last_goal_date) return 0;

    const gap = daysBetween(user.last_goal_date, today);
    if (streakSurvives(gap, graceAge(user, today))) return user.streak_current;

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

/**
 * Called after a deletion. If removing the entry drops the day back below the
 * goal, the goal is un-awarded: the streak steps back to whatever the previous
 * qualifying day supports, and the XP granted for it is taken back. Without
 * this you could hit your goal, delete everything, and keep the streak.
 */
export async function revokeGoalIfLost(user: User, today: string, totalMl: number): Promise<boolean> {
    if (user.last_goal_date !== today || totalMl >= user.goal_ml) return false;

    const previous = await queryOne<{ local_date: string | null }>(
        `SELECT MAX(local_date)::text AS local_date FROM (
             SELECT local_date, ${HYDRATING_SUM_SQL} AS total
             FROM intakes
             WHERE user_id = $1 AND local_date < $2
             GROUP BY local_date
         ) days
         WHERE total >= $3`,
        [user.id, today, user.goal_ml]
    );

    const previousGoalDate = previous?.local_date ?? null;
    const gap = previousGoalDate === null ? null : daysBetween(previousGoalDate, today);

    // If today's goal spent a repair, hand it back. The run then rests on a
    // two-day gap again, which the returned repair still covers, so the streak
    // steps back to what it was rather than collapsing.
    const releasedRepair = user.streak_grace_at === today;
    const standsUp = gap === 1 || (gap === 2 && releasedRepair);
    const streak = standsUp ? Math.max(0, user.streak_current - 1) : 0;
    const refund = XP_PER_GOAL + Math.min(user.streak_current, 10) * XP_PER_STREAK_DAY;

    await query(
        `UPDATE users
         SET last_goal_date = $2, streak_current = $3, xp = GREATEST(0, xp - $4),
             streak_grace_at = CASE WHEN $6 THEN NULL ELSE streak_grace_at END
         WHERE id = $1 AND last_goal_date = $5`,
        [user.id, previousGoalDate, streak, refund, today, releasedRepair]
    );
    return true;
}
