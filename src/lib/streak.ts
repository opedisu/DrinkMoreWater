// Streak arithmetic, kept free of dates and the database so it can be read
// and checked on its own. Callers convert their dates to day counts first.

/** A missed day can be forgiven once in this many days. */
export const GRACE_INTERVAL_DAYS = 7;

export interface StreakOutcome {
    streak: number;
    /** True when a missed day was forgiven to get here. */
    repaired: boolean;
}

/**
 * graceAgeDays is the days since the last repair, or null if never repaired.
 */
export function graceAvailable(graceAgeDays: number | null): boolean {
    return graceAgeDays === null || graceAgeDays >= GRACE_INTERVAL_DAYS;
}

/**
 * Whether a streak is still alive given the gap since the day it last
 * counted. One day means yesterday, so nothing was missed. Two means one
 * missed day, which a repair can cover.
 *
 * Asked on every read, so it must not consume the repair: the day may pass
 * without a goal being met, and then the gap simply grows past saving.
 */
export function streakSurvives(gapDays: number, graceAgeDays: number | null): boolean {
    if (gapDays <= 1) return true;
    return gapDays === 2 && graceAvailable(graceAgeDays);
}

/**
 * The streak after today's goal, given the gap since the last one.
 *
 * A repair keeps the run intact but does not credit the missed day: today
 * adds one, exactly as an unbroken day would.
 */
export function streakAfterGoal(
    streakCurrent: number,
    gapDays: number,
    graceAgeDays: number | null
): StreakOutcome {
    if (gapDays === 1) return { streak: streakCurrent + 1, repaired: false };
    if (gapDays === 2 && graceAvailable(graceAgeDays)) {
        return { streak: streakCurrent + 1, repaired: true };
    }
    return { streak: 1, repaired: false };
}
