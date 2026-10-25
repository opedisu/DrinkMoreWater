"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const PENDING_NAV = "dmw-pending-nav";

/** Older than this and the tap was not what brought the app forward. */
const FRESH_MS = 60_000;

/** Same-origin paths only: a protocol-relative "//host" is a full URL. */
function isSafePath(value: unknown): value is string {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

/**
 * Takes the app to wherever a tapped notification pointed.
 *
 * Three things have to line up, because no single mechanism covers every
 * browser. The worker may navigate the window itself, which iOS cannot do.
 * It may post a message, which a frozen page never receives. So it also
 * leaves a note in the Cache API, and this reads it on waking, which is the
 * case the other two miss.
 */
export default function PushRouter() {
    const router = useRouter();
    const pathname = usePathname();

    const consumePendingNav = useCallback(async () => {
        if (typeof caches === "undefined") return;
        try {
            const cache = await caches.open(PENDING_NAV);
            const hit = await cache.match("/pending");
            if (!hit) return;

            await cache.delete("/pending");
            const { url, at } = (await hit.json()) as { url?: unknown; at?: unknown };

            if (typeof at !== "number" || Date.now() - at > FRESH_MS) return;
            if (!isSafePath(url) || url === pathname) return;

            router.push(url);
        } catch {
            // Storage unavailable or malformed. Nothing to act on.
        }
    }, [pathname, router]);

    useEffect(() => {
        void consumePendingNav();

        const onVisible = () => {
            if (document.visibilityState === "visible") void consumePendingNav();
        };
        document.addEventListener("visibilitychange", onVisible);

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === "navigate" && isSafePath(event.data.url)) {
                router.push(event.data.url);
            }
        };
        const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
        sw?.addEventListener("message", onMessage);

        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            sw?.removeEventListener("message", onMessage);
        };
    }, [consumePendingNav, router]);

    return null;
}
