import { query, queryOne } from "./db";
import { HYDRATING_SUM_SQL } from "./drinks";
import { localDate, localMinuteOfDay } from "./time";
import { listBadges, reconcileStreak } from "./rewards";
import { levelFromXp, levelTitle } from "./progression";
import { pacedTargetMl } from "./goal";
import type { ActivityLevel, Intake, Unit, User } from "./types";

/** The full client-facing view of a user. Shared by /api/me and the pages. */
export interface Snapshot {
    user: {
        id: string;
        email: string;
        name: string;
        timezone: string;
        unit: Unit;
        goalMl: number;
        weightKg: number | null;
        activityLevel: ActivityLevel;
        hotClimate: boolean;
        remindersOn: boolean;
        smartPacing: boolean;
        wakeMinute: number;
        sleepMinute: number;
        intervalMinutes: number;
        buddyCode: string;
        onboarded: boolean;
        lastRemindAt: string | null;
    };
    today: {
        date: string;
        minuteOfDay: number;
        totalMl: number;
        goalMl: number;
        pacedTargetMl: number;
        logs: Intake[];
    };
    rewards: {
        streakCurrent: number;
        streakBest: number;
        xp: number;
        level: number;
        levelTitle: string;
        intoLevel: number;
        levelSpan: number;
        badges: { code: string; earned_at: string }[];
    };
}

export async function buildSnapshot(user: User): Promise<Snapshot> {
    const today = localDate(user.timezone);
    const minuteOfDay = localMinuteOfDay(user.timezone);
    const streak = await reconcileStreak(user, today);

    const [totals, logs, badges] = await Promise.all([
        queryOne<{ total: string }>(
            `SELECT ${HYDRATING_SUM_SQL}::text AS total FROM intakes WHERE user_id = $1 AND local_date = $2`,
            [user.id, today]
        ),
        query<Intake>(
            `SELECT id, amount_ml, drink, created_at
             FROM intakes
             WHERE user_id = $1 AND local_date = $2
             ORDER BY created_at DESC`,
            [user.id, today]
        ),
        listBadges(user.id)
    ]);

    const level = levelFromXp(user.xp);

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            timezone: user.timezone,
            unit: user.unit,
            goalMl: user.goal_ml,
            weightKg: user.weight_kg === null ? null : Number(user.weight_kg),
            activityLevel: user.activity_level,
            hotClimate: user.hot_climate,
            remindersOn: user.reminders_on,
            smartPacing: user.smart_pacing,
            wakeMinute: user.wake_minute,
            sleepMinute: user.sleep_minute,
            intervalMinutes: user.interval_minutes,
            buddyCode: user.buddy_code,
            onboarded: user.weight_kg !== null,
            lastRemindAt: user.last_remind_at
        },
        today: {
            date: today,
            minuteOfDay,
            totalMl: Number(totals?.total ?? 0),
            goalMl: user.goal_ml,
            pacedTargetMl: pacedTargetMl(user.goal_ml, minuteOfDay, user.wake_minute, user.sleep_minute),
            logs
        },
        rewards: {
            streakCurrent: streak,
            streakBest: user.streak_best,
            xp: user.xp,
            level: level.level,
            levelTitle: levelTitle(level.level),
            intoLevel: level.intoLevel,
            levelSpan: level.levelSpan,
            badges
        }
    };
}
