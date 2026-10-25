import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { isValidTimezone } from "@/lib/time";
import { clampGoal, recommendedGoalMl } from "@/lib/goal";
import type { ActivityLevel, Unit } from "@/lib/types";

export const runtime = "nodejs";

const ACTIVITY: ActivityLevel[] = ["low", "moderate", "high"];
const UNITS: Unit[] = ["ml", "oz"];
const INTERVALS = [30, 45, 60, 90, 120, 180];

interface SettingsPayload {
    name?: string;
    timezone?: string;
    unit?: Unit;
    goalMl?: number;
    autoGoal?: boolean;
    weightKg?: number | null;
    activityLevel?: ActivityLevel;
    hotClimate?: boolean;
    remindersOn?: boolean;
    smartPacing?: boolean;
    wakeMinute?: number;
    sleepMinute?: number;
    intervalMinutes?: number;
}

export async function PUT(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let payload: SettingsPayload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : user.name;
    const timezone = payload.timezone && isValidTimezone(payload.timezone) ? payload.timezone : user.timezone;
    const unit = UNITS.includes(payload.unit as Unit) ? (payload.unit as Unit) : user.unit;
    const activityLevel = ACTIVITY.includes(payload.activityLevel as ActivityLevel)
        ? (payload.activityLevel as ActivityLevel)
        : user.activity_level;
    const hotClimate = typeof payload.hotClimate === "boolean" ? payload.hotClimate : user.hot_climate;

    let weightKg: number | null = user.weight_kg === null ? null : Number(user.weight_kg);
    if (payload.weightKg === null) {
        weightKg = null;
    } else if (typeof payload.weightKg === "number" && Number.isFinite(payload.weightKg)) {
        if (payload.weightKg < 25 || payload.weightKg > 300) {
            return NextResponse.json({ error: "Weight must be between 25 and 300 kg." }, { status: 400 });
        }
        weightKg = Math.round(payload.weightKg * 10) / 10;
    }

    const goalMl = payload.autoGoal
        ? recommendedGoalMl(weightKg, activityLevel, hotClimate)
        : typeof payload.goalMl === "number" && Number.isFinite(payload.goalMl)
          ? clampGoal(payload.goalMl)
          : user.goal_ml;

    const remindersOn = typeof payload.remindersOn === "boolean" ? payload.remindersOn : user.reminders_on;
    const smartPacing = typeof payload.smartPacing === "boolean" ? payload.smartPacing : user.smart_pacing;

    const wakeMinute = clampMinute(payload.wakeMinute, user.wake_minute);
    const sleepMinute = clampMinute(payload.sleepMinute, user.sleep_minute);
    if (sleepMinute - wakeMinute < 180) {
        return NextResponse.json({ error: "Leave at least 3 hours between wake and sleep times." }, { status: 400 });
    }

    const intervalMinutes = INTERVALS.includes(Number(payload.intervalMinutes))
        ? Number(payload.intervalMinutes)
        : user.interval_minutes;

    await query(
        `UPDATE users SET
             name = $2, timezone = $3, unit = $4, goal_ml = $5, weight_kg = $6,
             activity_level = $7, hot_climate = $8, reminders_on = $9, smart_pacing = $10,
             wake_minute = $11, sleep_minute = $12, interval_minutes = $13
         WHERE id = $1`,
        [
            user.id, name, timezone, unit, goalMl, weightKg, activityLevel, hotClimate,
            remindersOn, smartPacing, wakeMinute, sleepMinute, intervalMinutes
        ]
    );

    return NextResponse.json({ ok: true, goalMl, recommendedMl: recommendedGoalMl(weightKg, activityLevel, hotClimate) });
}

function clampMinute(value: unknown, fallback: number): number {
    const minute = Math.round(Number(value));
    if (!Number.isFinite(minute) || minute < 0 || minute > 1439) return fallback;
    return minute;
}
