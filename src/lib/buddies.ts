import { query, queryOne } from "./db";
import { HYDRATING_SUM_SQL } from "./drinks";
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
    week: number[] | null;
}

/**
 * The last seven days for everyone this user follows, each counted in that
 * buddy's own timezone. The series is oldest first, so the final entry is
 * their today.
 *
 * One query, whatever the number of buddies: the week is built inside the
 * statement rather than by asking per person.
 */
export async function loadBuddies(userId: string): Promise<BuddySummary[]> {
    const rows = await query<BuddyRow>(
        `SELECT u.id, u.name, u.goal_ml, u.streak_current, u.xp, u.unit, w.week
         FROM buddies b
         JOIN users u ON u.id = b.buddy_id
         LEFT JOIN LATERAL (
             SELECT ARRAY(
                 SELECT COALESCE((
                     SELECT ${HYDRATING_SUM_SQL}
                     FROM intakes
                     WHERE user_id = u.id
                       AND local_date = (NOW() AT TIME ZONE u.timezone)::date - offset_days
                 ), 0)::int
                 FROM generate_series(6, 0, -1) AS offset_days
             ) AS week
         ) w ON TRUE
         WHERE b.user_id = $1
         ORDER BY u.name`,
        [userId]
    );

    return rows.map((row) => {
        const week = row.week ?? [];
        return {
            id: row.id,
            name: row.name,
            today_ml: week[week.length - 1] ?? 0,
            goal_ml: row.goal_ml,
            streak_current: row.streak_current,
            level: levelFromXp(row.xp).level,
            unit: row.unit,
            week
        };
    });
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

export interface Follower {
    id: string;
    name: string;
    created_at: string;
}

/** The people who can see this user's progress and send them nudges. */
export async function loadFollowers(userId: string): Promise<Follower[]> {
    return query<Follower>(
        `SELECT u.id, u.name, b.created_at
         FROM buddies b
         JOIN users u ON u.id = b.user_id
         WHERE b.buddy_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
    );
}

/**
 * Removes a follower and blocks them, so they cannot simply re-add the code.
 * Blocking is one-directional and silent -- the other person is not told.
 */
export async function removeFollower(userId: string, followerId: string): Promise<void> {
    await query("DELETE FROM buddies WHERE user_id = $1 AND buddy_id = $2", [followerId, userId]);
    await query(
        "INSERT INTO buddy_blocks (user_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, followerId]
    );
}

export async function isBlocked(ownerId: string, viewerId: string): Promise<boolean> {
    const row = await queryOne<{ blocked_id: string }>(
        "SELECT blocked_id FROM buddy_blocks WHERE user_id = $1 AND blocked_id = $2",
        [ownerId, viewerId]
    );
    return row !== null;
}
