"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle, DownloadSimple, Export, PlusSquare, X } from "@phosphor-icons/react";
import { isIos, isStandalone } from "@/lib/pushClient";

/**
 * Getting the app onto the home screen is a prerequisite for reminders on
 * iOS, and reminders are the whole product. Leaving that to be explained
 * person to person meant most people would never get there.
 *
 * Two different problems wearing one name:
 *   - Chromium can install programmatically, so it gets a button.
 *   - Safari cannot, so it gets the three taps, with the real Share glyph.
 */

interface InstallPrompt extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "dmw.install.dismissed";

type Mode = "hidden" | "installed" | "prompt" | "ios" | "manual";

export default function InstallGuide({ compact = false }: { compact?: boolean }) {
    const [deferred, setDeferred] = useState<InstallPrompt | null>(null);
    // Only set from events, never during render or synchronously in an effect.
    const [override, setOverride] = useState<Mode | null>(null);

    // The platform does not change for the life of the page, and the server
    // cannot know it. "hidden" is the server snapshot so nothing renders
    // until the client can answer, which keeps hydration honest.
    const baseMode = useSyncExternalStore(subscribeNever, readPlatform, () => "hidden" as Mode);
    const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => false);
    const mode = override ?? baseMode;

    useEffect(() => {
        // Chromium fires this instead of showing its own bar, and only once,
        // so it has to be captured on mount and kept.
        const onPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as InstallPrompt);
            setOverride("prompt");
        };
        const onInstalled = () => setOverride("installed");

        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        if (!deferred) return;
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        // The event cannot be reused, so drop it and fall back to guidance.
        setDeferred(null);
        setOverride(outcome === "accepted" ? "installed" : "manual");
    }, [deferred]);

    // Settings always shows it, so dismissing on the main screen is safe.
    if (mode === "hidden" || (dismissed && !compact)) return null;

    if (mode === "installed") {
        // In the settings list this is worth confirming; on the main screen
        // it would just be clutter.
        if (!compact) return null;
        return (
            <p className="muted install-done">
                <CheckCircle size={16} weight="fill" aria-hidden="true" />
                Installed on this device. Reminders can reach you here.
            </p>
        );
    }

    return (
        <section className={`install-card${compact ? " compact" : ""}`}>
            {!compact && (
                <button
                    className="install-dismiss"
                    aria-label="Hide install instructions"
                    onClick={dismiss}
                >
                    <X size={14} weight="bold" />
                </button>
            )}

            <p className="install-line">
                <DownloadSimple size={17} weight="duotone" aria-hidden="true" />
                <span>
                    <strong>Add to your home screen</strong> so reminders can reach you.
                </span>
            </p>

            {mode === "prompt" && (
                <button className="btn btn-primary install-action" onClick={install}>
                    Install app
                </button>
            )}

            {mode === "ios" && (
                <ol className="install-steps">
                    <li>
                        <span className="install-step-icon" aria-hidden="true">
                            <Export size={17} weight="bold" />
                        </span>
                        Tap the Share button in Safari&apos;s toolbar
                    </li>
                    <li>
                        <span className="install-step-icon" aria-hidden="true">
                            <PlusSquare size={17} weight="bold" />
                        </span>
                        Choose <strong>Add to Home Screen</strong>
                    </li>
                    <li>
                        <span className="install-step-icon" aria-hidden="true">
                            <CheckCircle size={17} weight="bold" />
                        </span>
                        Open DrinkMoreWater from your home screen
                    </li>
                </ol>
            )}

            {mode === "manual" && (
                <p className="muted install-manual">
                    Use your browser menu: <strong>Install</strong> or <strong>Add to Home screen</strong>.
                </p>
            )}
        </section>
    );
}

function readPlatform(): Mode {
    if (isStandalone()) return "installed";
    return isIos() ? "ios" : "manual";
}

/** The platform answer never changes for the life of the page. */
function subscribeNever(): () => void {
    return () => {};
}

/**
 * Dismissal is a per-device convenience, so it lives in localStorage rather
 * than on the account. Every access is guarded because storage throws in
 * private mode, and the value is cached so the snapshot stays referentially
 * stable between renders.
 */
let dismissedCache: boolean | null = null;
const dismissListeners = new Set<() => void>();

function readDismissed(): boolean {
    if (dismissedCache === null) {
        try {
            dismissedCache = localStorage.getItem(DISMISS_KEY) === "1";
        } catch {
            dismissedCache = false;
        }
    }
    return dismissedCache;
}

function dismiss(): void {
    dismissedCache = true;
    try {
        localStorage.setItem(DISMISS_KEY, "1");
    } catch {
        // Not persisting is fine; the card reappears next visit.
    }
    for (const listener of dismissListeners) listener();
}

function subscribeDismissed(listener: () => void): () => void {
    dismissListeners.add(listener);
    return () => {
        dismissListeners.delete(listener);
    };
}
