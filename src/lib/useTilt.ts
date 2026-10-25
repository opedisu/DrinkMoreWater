"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** iOS gates both sensors behind a call that has to follow a user gesture. */
type GatedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };
type GatedMotion = typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> };

/**
 * Flip this if the water leans the wrong way. The sign depends on the
 * platform's axis convention and cannot be checked without a real device.
 */
const DIRECTION = -1;

/** How much of the real roll to apply. Full roll is too lively to read. */
const DAMPING = 0.4;

/** Below this the phone is near flat and the in-plane angle is meaningless. */
const MIN_IN_PLANE = 2;

export function tiltNeedsPermission(): boolean {
    return (
        typeof window !== "undefined" &&
        "DeviceOrientationEvent" in window &&
        typeof (DeviceOrientationEvent as GatedOrientation).requestPermission === "function"
    );
}

/**
 * Rolls the liquid with the device so the surface stays level.
 *
 * Reads gravity rather than the orientation event's gamma. Gamma is an
 * Euler angle, and when a phone is held up to be looked at the pitch nears
 * 90 degrees, where gamma is degenerate: it holds a large value or swings
 * about while the phone is actually level, so the water never straightened.
 * The in-plane components of gravity have no such singularity.
 *
 * The angle is written straight to a CSS custom property. The sensor fires
 * at up to 60Hz and setState would re-render the tree on every reading.
 */
export function useTilt(ref: RefObject<SVGSVGElement | null>, limit = 7) {
    const attached = useRef(false);

    const attach = useCallback(() => {
        if (attached.current || typeof window === "undefined") return;
        attached.current = true;

        const handler = (event: DeviceMotionEvent) => {
            const node = ref.current;
            const gravity = event.accelerationIncludingGravity;
            if (node == null || gravity?.x == null || gravity.y == null) return;

            // Only the part of gravity lying in the screen plane matters. Flat
            // on a table that is near zero and the angle is noise, so level out.
            const inPlane = Math.hypot(gravity.x, gravity.y);
            const roll =
                inPlane < MIN_IN_PLANE ? 0 : Math.atan2(gravity.x, -gravity.y) * (180 / Math.PI);

            const degrees = Math.max(-limit, Math.min(limit, DIRECTION * roll * DAMPING));
            node.style.setProperty("--tilt", `${degrees.toFixed(2)}deg`);
        };

        window.addEventListener("devicemotion", handler);
    }, [limit, ref]);

    /** Call from a user gesture on iOS. Resolves to whether tilt is now on. */
    const request = useCallback(async (): Promise<boolean> => {
        try {
            const orientation = (DeviceOrientationEvent as GatedOrientation).requestPermission;
            const motion = (DeviceMotionEvent as GatedMotion).requestPermission;

            // Motion carries the reading; orientation is asked for too because
            // iOS treats them as one grant and some versions gate on either.
            const states = await Promise.all([
                typeof motion === "function" ? motion() : Promise.resolve("granted" as PermissionState),
                typeof orientation === "function"
                    ? orientation()
                    : Promise.resolve("granted" as PermissionState)
            ]);

            if (states.some((state) => state === "granted")) {
                attach();
                return true;
            }
        } catch {
            // Declined or unavailable. The vessel simply stays level.
        }
        return false;
    }, [attach]);

    useEffect(() => {
        if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        if (tiltNeedsPermission()) return; // waits for request()
        attach();
    }, [attach]);

    return request;
}
