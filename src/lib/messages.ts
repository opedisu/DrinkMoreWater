import { formatAmount } from "./goal";
import type { Unit } from "./types";

/**
 * Reminder copy. Deliberately warm and varied -- a notification that reads
 * the same every 90 minutes gets swiped away and then switched off.
 */
const NUDGES = [
    "Time for a glass 💧",
    "Hydration check — grab some water",
    "Your body called. It wants water 🚰",
    "Quick sip break?",
    "Water o'clock ⏰",
    "Put the kettle down, have some water first 😄",
    "Small sip, big difference",
    "Still got water left in that bottle?"
];

const BEHIND_NUDGES = [
    "You're a bit behind today — catch up with a glass 💧",
    "Let's close the gap. Water time!",
    "A glass now keeps the evening easy 🙂"
];

const NEARLY_THERE = [
    "So close! One more glass does it 🎯",
    "Almost at your goal — finish strong 💪",
    "One glass between you and the streak 🔥"
];

export function reminderMessage(options: {
    name: string;
    remainingMl: number;
    goalMl: number;
    unit: Unit;
    behind: boolean;
}): { title: string; body: string } {
    const { name, remainingMl, goalMl, unit, behind } = options;
    const remaining = formatAmount(remainingMl, unit);
    const fractionLeft = remainingMl / goalMl;

    let title: string;
    if (fractionLeft <= 0.2) {
        title = pick(NEARLY_THERE);
    } else if (behind) {
        title = pick(BEHIND_NUDGES);
    } else {
        title = pick(NUDGES);
    }

    const who = name ? `${name}, ` : "";
    return {
        title,
        body: `${who}${remaining} left to reach ${formatAmount(goalMl, unit)} today.`
    };
}

export function celebrationMessage(streak: number): { title: string; body: string } {
    if (streak >= 30) {
        return { title: "Goal hit 🏆", body: `${streak} days in a row. This is a habit now.` };
    }
    if (streak >= 7) {
        return { title: "Goal hit 🔥", body: `${streak}-day streak and counting. Brilliant.` };
    }
    if (streak > 1) {
        return { title: "Goal hit 🎉", body: `${streak} days in a row. Keep it rolling.` };
    }
    return { title: "Goal hit 🎉", body: "Full goal reached today. Streak started!" };
}

function pick<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}
