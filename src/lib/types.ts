export type ActivityLevel = "low" | "moderate" | "high";
export type Unit = "ml" | "oz";

export interface User {
    id: string;
    email: string;
    name: string;
    timezone: string;
    unit: Unit;
    goal_ml: number;
    weight_kg: string | null;
    activity_level: ActivityLevel;
    hot_climate: boolean;
    reminders_on: boolean;
    smart_pacing: boolean;
    wake_minute: number;
    sleep_minute: number;
    interval_minutes: number;
    buddy_code: string;
    streak_current: number;
    streak_best: number;
    xp: number;
    last_goal_date: string | null;
    last_remind_at: string | null;
    created_at: string;
}

export interface Intake {
    id: string;
    amount_ml: number;
    drink: string;
    created_at: string;
}

export interface DayTotal {
    local_date: string;
    total_ml: number;
}

export interface BuddySummary {
    id: string;
    name: string;
    today_ml: number;
    goal_ml: number;
    streak_current: number;
    level: number;
    unit: Unit;
}
