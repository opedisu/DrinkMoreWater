import { query, queryOne } from "./db";
import { localDate } from "./time";
import { levelFromXp } from "./progression";
import { celebrationMessage } from "./messages";
import { sendToUser } from "./push";
import type { BuddySummary, Unit, User } from "./types";

interface BuddyRow {
    id: string;
    name: string;
    goal_ml: number;
    streak_current: number;
    xp: number;
    unit: Unit;
    timezone: string;
}

/** Today's progress for everyone this user follows, in each buddy's own day. */
export async function loadBuddies(userId: string): Promise<BuddySummary[]> {
    const rows = await query<BuddyRow>(
        `SELECT u.id, u.name, u.goal_ml, u.streak_current, u.xp, u.unit, u.timezone
         FROM buddies b
         JOIN users u ON u.id = b.buddy_id
         WHERE b.user_id = $1
         ORDER BY u.name`,
        [userId]
    );

    return Promise.all(
        rows.map(async (row) => {
            const totals = await queryOne<{ total: string }>(
                "SELECT COALESCE(SUM(amount_ml), 0)::text AS total FROM intakes WHERE user_id = $1 AND local_date = $2",
                [row.id, localDate(row.timezone)]
            );
            return {
                id: row.id,
                name: row.name,
                today_ml: Number(totals?.total ?? 0),
                goal_ml: row.goal_ml,
                streak_current: row.streak_current,
                level: levelFromXp(row.xp).level,
                unit: row.unit
            };
        })
    );
}

/**
 * Tells everyone following this user that they hit their goal. Fires at most
 * once a day per user, since the goal itself is only registered once.
 */
export async function notifyFollowersOfGoal(user: User, streak: number): Promise<void> {
    const followers = await query<{ user_id: string }>(
        "SELECT user_id FROM buddies WHERE buddy_id = $1",
        [user.id]
    );
    if (followers.length === 0) return;

    const message = celebrationMessage(streak);
    const name = user.name || "Your buddy";

    await Promise.all(
        followers.map((follower) =>
            sendToUser(follower.user_id, {
                title: `${name} hit their goal 🎉`,
                body: message.body,
                tag: `dmw-buddy-goal-${user.id}`,
                url: "/buddies"
            })
        )
    );
}
