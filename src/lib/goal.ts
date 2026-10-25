import type { ActivityLevel } from "./types";

export const ML_PER_OZ = 29.5735;

const ACTIVITY_BONUS_ML: Record<ActivityLevel, number> = {
    low: 0,
    moderate: 350,
    high: 700
};

/**
 * 35 ml per kg of body weight is the widely used practical baseline, plus a
 * flat allowance for activity and for hot climates (relevant for most of the
 * markets this app is aimed at). Clamped to a sane range -- drinking far
 * beyond need is not better, and in extreme cases is dangerous.
 */
export function recommendedGoalMl(
    weightKg: number | null,
    activity: ActivityLevel,
    hotClimate: boolean
): number {
    const base = weightKg && weightKg > 0 ? weightKg * 35 : 2200;
    const total = base + ACTIVITY_BONUS_ML[activity] + (hotClimate ? 400 : 0);
    return clampGoal(Math.round(total / 50) * 50);
}

export function clampGoal(goalMl: number): number {
    return Math.min(5000, Math.max(1200, Math.round(goalMl)));
}

/** Soft ceiling. Above this we stop celebrating and show a gentle warning. */
export function excessiveThresholdMl(goalMl: number): number {
    return Math.max(4000, Math.round(goalMl * 1.6));
}

export function toDisplay(amountMl: number, unit: "ml" | "oz"): number {
    return unit === "oz" ? Math.round(amountMl / ML_PER_OZ) : Math.round(amountMl);
}

export function formatAmount(amountMl: number, unit: "ml" | "oz"): string {
    if (unit === "oz") return `${toDisplay(amountMl, "oz")} oz`;
    if (amountMl < 1000) return `${Math.round(amountMl)} ml`;
    // 1500 -> "1.5 L", 3050 -> "3.05 L", 3000 -> "3.0 L"
    const litres = (amountMl / 1000).toFixed(2).replace(/0$/, "");
    return `${litres} L`;
}

/**
 * Minutes a person is awake, for a window that may cross midnight.
 * 10:00 to 03:00 is seventeen hours awake, not minus seven.
 */
export function wakingSpanMinutes(wakeMinute: number, sleepMinute: number): number {
    return (((sleepMinute - wakeMinute) % 1440) + 1440) % 1440;
}

/** Minutes elapsed since waking, wrapping across midnight. */
function minutesSinceWake(minuteOfDay: number, wakeMinute: number): number {
    return (((minuteOfDay - wakeMinute) % 1440) + 1440) % 1440;
}

/** Whether this local minute falls inside the waking window. */
export function isAwakeAt(minuteOfDay: number, wakeMinute: number, sleepMinute: number): boolean {
    const span = wakingSpanMinutes(wakeMinute, sleepMinute);
    if (span === 0) return false;
    return minutesSinceWake(minuteOfDay, wakeMinute) <= span;
}

/**
 * How much should already be drunk at this point of the waking day. Used for
 * smart reminders -- someone who is ahead of pace does not need a nudge.
 *
 * Works in minutes since waking rather than clock time, so a night owl whose
 * day ends at 03:00 is paced over their real seventeen hours instead of a
 * window that runs backwards.
 */
export function pacedTargetMl(
    goalMl: number,
    minuteOfDay: number,
    wakeMinute: number,
    sleepMinute: number
): number {
    const span = wakingSpanMinutes(wakeMinute, sleepMinute);
    if (span === 0) return 0;

    const since = minutesSinceWake(minuteOfDay, wakeMinute);
    if (since > span) {
        // Asleep. Before today's wake nothing is expected yet; after the
        // window closed the whole goal was.
        return minuteOfDay < wakeMinute ? 0 : goalMl;
    }

    // Aim to finish drinking an hour before bed so reminders do not cost sleep.
    const windowEnd = Math.max(60, span - 60);
    if (since >= windowEnd) return goalMl;
    return Math.round(goalMl * (since / windowEnd));
}
