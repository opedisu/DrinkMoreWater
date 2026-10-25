// All day-boundary logic runs in the user's own timezone so that a 1am glass
// of water counts for the right day, wherever they are.

export function localDate(timezone: string, at: Date = new Date()): string {
    try {
        // en-CA formats as YYYY-MM-DD.
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(at);
    } catch {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(at);
    }
}

/** Minutes elapsed since local midnight, 0-1439. */
export function localMinuteOfDay(timezone: string, at: Date = new Date()): number {
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(at);
    } catch {
        parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(at);
    }

    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return (hour % 24) * 60 + minute;
}

/**
 * Wall-clock time in the user's own zone. The locale is pinned because the
 * server and the browser do not share one, and an unpinned format rendered
 * "17:22" on one and "05:22 PM" on the other, which cost a hydration pass.
 *
 * Formatters are cached per zone: the log list would otherwise construct one
 * per entry on every render. The catch matters because a zone the server's
 * ICU accepts can still be unknown to an older mobile browser, and an
 * uncaught RangeError here unmounts the whole screen.
 */
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatClock(timezone: string, at: Date): string {
    let formatter = clockFormatters.get(timezone);

    if (!formatter) {
        const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
        try {
            formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone });
        } catch {
            formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
        }
        clockFormatters.set(timezone, formatter);
    }

    return formatter.format(at);
}

export function isValidTimezone(timezone: string): boolean {
    try {
        new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
        return true;
    } catch {
        return false;
    }
}

export function formatMinute(minuteOfDay: number): string {
    const minutes = ((minuteOfDay % 1440) + 1440) % 1440;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

export function parseMinute(value: string, fallback: number): number {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return fallback;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1439) return fallback;
    return minutes;
}

/** Shifts a YYYY-MM-DD string by whole days without touching timezones. */
export function shiftDate(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    const base = Date.UTC(y, m - 1, d) + days * 86_400_000;
    return new Date(base).toISOString().slice(0, 10);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
    const [fy, fm, fd] = fromIsoDate.split("-").map(Number);
    const [ty, tm, td] = toIsoDate.split("-").map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
