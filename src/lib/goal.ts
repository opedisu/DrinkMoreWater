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
 * How much should already be drunk at this point of the waking day. Used for
 * smart reminders -- someone who is ahead of pace does not need a nudge.
 */
export function pacedTargetMl(
    goalMl: number,
    minuteOfDay: number,
    wakeMinute: number,
    sleepMinute: number
): number {
    // Aim to finish drinking an hour before bed so reminders do not cost sleep.
    const windowEnd = Math.max(wakeMinute + 60, sleepMinute - 60);
    if (minuteOfDay <= wakeMinute) return 0;
    if (minuteOfDay >= windowEnd) return goalMl;
    const progress = (minuteOfDay - wakeMinute) / (windowEnd - wakeMinute);
    return Math.round(goalMl * progress);
}
