"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Routes the page when a notification is tapped and the service worker
 * could not navigate the window itself.
 *
 * client.navigate is unavailable in some browsers, iOS among them, so the
 * worker falls back to posting the destination here. This has to be mounted
 * app-wide: the reminder can be tapped while any page is open, which is
 * exactly the case that used to drop people wherever they already were.
 */
export default function PushRouter() {
    const router = useRouter();

    useEffect(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

        const handler = (event: MessageEvent) => {
            if (event.data?.type !== "navigate") return;

            const url: unknown = event.data.url;
            // Same-origin paths only. A protocol-relative "//evil.com" is a
            // full URL, so the second character matters.
            if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return;

            router.push(url);
        };

        navigator.serviceWorker.addEventListener("message", handler);
        return () => navigator.serviceWorker.removeEventListener("message", handler);
    }, [router]);

    return null;
}
