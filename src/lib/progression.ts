/**
 * Badge catalogue and level maths. Pure, no database access, so both the
 * server and client components can import it.
 */

export interface Badge {
    code: string;
    name: string;
    description: string;
    emoji: string;
}

export const BADGES: Badge[] = [
    { code: "first_sip", name: "First Sip", description: "Logged your very first drink", emoji: "💧" },
    { code: "first_goal", name: "Day One", description: "Hit your daily goal for the first time", emoji: "🎯" },
    { code: "streak_3", name: "Three in a Row", description: "3-day streak", emoji: "🔥" },
    { code: "streak_7", name: "Full Week", description: "7-day streak", emoji: "🗓️" },
    { code: "streak_30", name: "Habit Formed", description: "30-day streak", emoji: "🏆" },
    { code: "streak_100", name: "Centurion", description: "100-day streak", emoji: "💎" },
    { code: "early_bird", name: "Early Bird", description: "Logged a drink before 8am", emoji: "🌅" },
    { code: "night_finisher", name: "Clean Sweep", description: "Hit your goal before 6pm", emoji: "⚡" },
    { code: "logs_50", name: "Fifty Sips", description: "50 drinks logged", emoji: "📈" },
    { code: "logs_250", name: "Hydration Veteran", description: "250 drinks logged", emoji: "🥇" },
    { code: "buddy_up", name: "Better Together", description: "Linked up with a buddy", emoji: "💞" }
];

export const BADGE_BY_CODE = new Map(BADGES.map((badge) => [badge.code, badge]));

export const XP_PER_LOG = 5;
export const XP_PER_GOAL = 40;
export const XP_PER_STREAK_DAY = 5;

/** Levels get progressively wider: level n needs 100 * n XP to clear. */
export function levelFromXp(xp: number): { level: number; intoLevel: number; levelSpan: number } {
    let level = 1;
    let remaining = Math.max(0, xp);
    let span = 100;

    while (remaining >= span) {
        remaining -= span;
        level += 1;
        span = level * 100;
    }
    return { level, intoLevel: remaining, levelSpan: span };
}

export function levelTitle(level: number): string {
    if (level >= 25) return "Hydration Legend";
    if (level >= 18) return "Water Sage";
    if (level >= 12) return "Deep Blue";
    if (level >= 8) return "Wave Rider";
    if (level >= 5) return "Steady Stream";
    if (level >= 3) return "Trickle";
    return "Droplet";
}

export const awardableCodes = new Set(BADGES.map((badge) => badge.code));
