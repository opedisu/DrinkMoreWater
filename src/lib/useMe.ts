"use client";

import { useCallback, useState } from "react";
import type { Snapshot } from "./snapshot";

/**
 * Holds the client-side copy of the user snapshot. Seeded from the server
 * render, then refreshed after any mutation -- no loading spinner on arrival.
 */
export function useSnapshot(initial: Snapshot) {
    const [data, setData] = useState<Snapshot>(initial);

    const refresh = useCallback(async () => {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) return null;
        const body = (await response.json()) as Snapshot;
        setData(body);
        return body;
    }, []);

    return { data, refresh, setData };
}

/** Sends the browser timezone once, for accounts that never set one. */
export async function adoptBrowserTimezone(current: string): Promise<void> {
    if (current !== "UTC") return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone })
    });
}
