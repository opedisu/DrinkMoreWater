"use client";

/** Browser-side push enrolment. Deliberately verbose about *why* it failed. */

export type PushState =
    | "unsupported"
    | "needs-install"
    | "prompt"
    | "denied"
    | "enabled"
    | "unconfigured";

export interface PushStatus {
    state: PushState;
    detail: string;
}

export function isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIos(): boolean {
    if (typeof navigator === "undefined") return false;
    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        // iPadOS 13+ reports as a Mac, but has touch points.
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    try {
        return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch (error) {
        console.error("service worker registration failed", error);
        return null;
    }
}

export async function pushStatus(vapidKey: string | undefined): Promise<PushStatus> {
    if (typeof window === "undefined") {
        return { state: "unsupported", detail: "" };
    }
    if (!vapidKey) {
        return { state: "unconfigured", detail: "Push keys are not configured on the server yet." };
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // Safari on iOS only exposes PushManager once installed to the Home Screen.
        if (isIos() && !isStandalone()) {
            return {
                state: "needs-install",
                detail: "On iPhone, add this app to your Home Screen first — Safari only allows reminders for installed apps."
            };
        }
        return { state: "unsupported", detail: "This browser cannot deliver push reminders." };
    }
    if (isIos() && !isStandalone()) {
        return {
            state: "needs-install",
            detail: "Tap Share → Add to Home Screen, then open it from there to turn on reminders."
        };
    }
    if (Notification.permission === "denied") {
        return {
            state: "denied",
            detail: "Notifications are blocked. Enable them for this site in your browser settings."
        };
    }

    const registration = await navigator.serviceWorker.getRegistration("/");
    const existing = await registration?.pushManager.getSubscription();
    if (Notification.permission === "granted" && existing) {
        return { state: "enabled", detail: "Reminders are on for this device." };
    }
    return { state: "prompt", detail: "Turn on reminders to get nudged through the day." };
}

export async function enablePush(vapidKey: string): Promise<{ ok: boolean; error?: string }> {
    const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    if (!registration) return { ok: false, error: "Could not start the background worker." };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        return { ok: false, error: "Permission was not granted." };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
    }

    const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: body.error ?? "Could not save the subscription." };
    }
    return { ok: true };
}

export async function disablePush(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;

    await subscription?.unsubscribe();
    await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
    });
}

/** VAPID keys arrive base64url-encoded; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}
