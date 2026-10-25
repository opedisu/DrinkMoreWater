import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A sweep older than this means the scheduler has stopped. */
const STALE_AFTER_MINUTES = 120;

/**
 * Deliberately public and free of user data, so an external uptime monitor can
 * poll it. It returns 503 when the reminder sweep has gone quiet, which turns
 * a silent scheduler failure into an alert.
 */
export async function GET(): Promise<NextResponse> {
    let databaseOk = false;
    let lastSweepAt: string | null = null;

    try {
        const row = await queryOne<{ value: string }>(
            "SELECT value FROM system_state WHERE key = 'last_sweep'"
        );
        databaseOk = true;
        lastSweepAt = row?.value ?? null;
    } catch (error) {
        console.error("health check: database unreachable", error);
    }

    const ageMinutes = lastSweepAt
        ? Math.round((Date.now() - new Date(lastSweepAt).getTime()) / 60_000)
        : null;

    // A deployment that has never run a sweep is not yet failing, so it is only
    // stale once a sweep has happened and then stopped.
    const schedulerStale = ageMinutes !== null && ageMinutes > STALE_AFTER_MINUTES;
    const ok = databaseOk && !schedulerStale;

    return NextResponse.json(
        {
            ok,
            database: databaseOk ? "up" : "down",
            scheduler: lastSweepAt === null ? "never-run" : schedulerStale ? "stale" : "ok",
            lastSweepAt,
            lastSweepAgeMinutes: ageMinutes
        },
        { status: ok ? 200 : 503 }
    );
}
