import { formatAmount } from "./goal";
import type { Unit } from "./types";

/**
 * Reminder copy. This is the most-read text in the product: everything else
 * is seen once, these are seen eight times a day.
 *
 * The register is quiet, specific and a little dry. A notification more
 * cheerful than the person reading it gets switched off, and emoji that
 * carries the warmth is a sign the words are not doing their job. Where
 * there is a real number, the number does the persuading: "400 ml to go" is
 * finite and true, "finish strong" is noise.
 */
const NUDGES = [
    "A glass now?",
    "Water's there when you want it.",
    "Still got water in that bottle?",
    "Time for a top-up.",
    "Worth a sip.",
    "This is your water reminder.",
    "Glass of water, while you think of it."
];

const BEHIND_NUDGES = [
    "Easier now than at 11pm.",
    "A bit behind. One glass closes most of it.",
    "Still catchable."
];

const NEARLY_THERE = ["One glass from done.", "Nearly there.", "Last stretch."];

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

    // The body is the number, every time. It is the part that actually moves
    // anyone, and it is the one thing the title cannot know.
    const who = name ? `${name}, ` : "";
    return {
        title,
        body: `${who}${remaining} to go today.`
    };
}

export function celebrationMessage(streak: number): { title: string; body: string } {
    if (streak >= 30) {
        return { title: "That's the goal", body: `${streak} days straight. It's a habit now, not a plan.` };
    }
    if (streak >= 7) {
        return { title: "That's the goal", body: `${streak} days straight.` };
    }
    if (streak > 1) {
        return { title: "That's the goal", body: `${streak} days in a row.` };
    }
    return { title: "That's the goal", body: "Full target, first day of the streak." };
}

function pick<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}
