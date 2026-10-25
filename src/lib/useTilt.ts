"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** iOS gates the sensor behind a call that has to follow a user gesture. */
type Gated = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };

export function tiltNeedsPermission(): boolean {
    return (
        typeof window !== "undefined" &&
        "DeviceOrientationEvent" in window &&
        typeof (DeviceOrientationEvent as Gated).requestPermission === "function"
    );
}

/**
 * Rolls the liquid with the device, so the surface stays level the way real
 * water does.
 *
 * The angle is written straight to a CSS custom property on the element
 * rather than into React state. The sensor fires at up to 60Hz and setState
 * would re-render the tree on every reading, which collapses on the phones
 * this is actually for.
 */
export function useTilt(ref: RefObject<SVGSVGElement | null>, limit = 7) {
    const attached = useRef(false);

    const attach = useCallback(() => {
        if (attached.current || typeof window === "undefined") return;
        attached.current = true;

        const handler = (event: DeviceOrientationEvent) => {
            const node = ref.current;
            if (node == null || event.gamma == null) return;
            // gamma is roughly -90..90 across a full roll. A third of it,
            // clamped, keeps the surface lively without it sloshing wildly.
            const degrees = Math.max(-limit, Math.min(limit, event.gamma / 3));
            node.style.setProperty("--tilt", `${degrees.toFixed(2)}deg`);
        };

        window.addEventListener("deviceorientation", handler);
    }, [limit, ref]);

    /** Call from a user gesture on iOS. A no-op everywhere else. */
    const request = useCallback(async () => {
        if (!tiltNeedsPermission()) return;
        try {
            const state = await (DeviceOrientationEvent as Gated).requestPermission?.();
            if (state === "granted") attach();
        } catch {
            // Declined or unavailable. The vessel simply stays level.
        }
    }, [attach]);

    useEffect(() => {
        if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        if (tiltNeedsPermission()) return; // waits for request()
        attach();
    }, [attach]);

    return request;
}
