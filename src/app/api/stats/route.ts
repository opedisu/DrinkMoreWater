import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { localDate, shiftDate } from "@/lib/time";
import type { DayTotal } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const requested = Number(new URL(request.url).searchParams.get("days") ?? 14);
    const days = Math.min(90, Math.max(7, Number.isFinite(requested) ? requested : 14));

    const today = localDate(user.timezone);
    const from = shiftDate(today, -(days - 1));

    const rows = await query<{ local_date: string; total: string }>(
        `SELECT local_date::text AS local_date, SUM(amount_ml)::text AS total
         FROM intakes
         WHERE user_id = $1 AND local_date BETWEEN $2 AND $3
         GROUP BY local_date
         ORDER BY local_date`,
        [user.id, from, today]
    );

    const byDate = new Map(rows.map((row) => [row.local_date, Number(row.total)]));
    const series: DayTotal[] = [];
    for (let i = 0; i < days; i += 1) {
        const date = shiftDate(from, i);
        series.push({ local_date: date, total_ml: byDate.get(date) ?? 0 });
    }

    const daysWithData = series.filter((day) => day.total_ml > 0);
    const goalsMet = series.filter((day) => day.total_ml >= user.goal_ml).length;
    const average = daysWithData.length > 0
        ? Math.round(daysWithData.reduce((sum, day) => sum + day.total_ml, 0) / daysWithData.length)
        : 0;

    return NextResponse.json({
        days,
        goalMl: user.goal_ml,
        unit: user.unit,
        series,
        summary: {
            averageMl: average,
            goalsMet,
            goalRate: Math.round((goalsMet / days) * 100),
            bestDayMl: series.reduce((best, day) => Math.max(best, day.total_ml), 0)
        }
    });
}
