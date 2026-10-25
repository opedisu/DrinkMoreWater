"use client";

import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Ring from "@/components/Ring";
import Confetti from "@/components/Confetti";
import { Toast, useToast } from "@/components/Toast";
import { adoptBrowserTimezone, useSnapshot } from "@/lib/useMe";
import type { Snapshot } from "@/lib/snapshot";
import { formatAmount, ML_PER_OZ } from "@/lib/goal";
import { BADGE_BY_CODE } from "@/lib/progression";
import { enablePush, pushStatus, registerServiceWorker, type PushStatus } from "@/lib/pushClient";
import type { Unit } from "@/lib/types";

// Round numbers in whichever unit the user reads, not converted oddities.
const PRESETS: Record<Unit, { amountMl: number; display: string; emoji: string }[]> = {
    ml: [
        { amountMl: 150, display: "150 ml", emoji: "☕" },
        { amountMl: 250, display: "250 ml", emoji: "🥛" },
        { amountMl: 500, display: "500 ml", emoji: "🍶" },
        { amountMl: 750, display: "750 ml", emoji: "🏺" }
    ],
    oz: [
        { amountMl: Math.round(6 * ML_PER_OZ), display: "6 oz", emoji: "☕" },
        { amountMl: Math.round(8 * ML_PER_OZ), display: "8 oz", emoji: "🥛" },
        { amountMl: Math.round(16 * ML_PER_OZ), display: "16 oz", emoji: "🍶" },
        { amountMl: Math.round(24 * ML_PER_OZ), display: "24 oz", emoji: "🏺" }
    ]
};

export default function TodayScreen({ initial, vapidKey }: { initial: Snapshot; vapidKey: string }) {
    const { data, refresh } = useSnapshot(initial);
    const { toast, show } = useToast();
    const [celebration, setCelebration] = useState(0);
    const [busy, setBusy] = useState(false);
    const [push, setPush] = useState<PushStatus | null>(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [customValue, setCustomValue] = useState("");

    const unit: Unit = data.user.unit;

    const log = useCallback(
        async (amountMl: number) => {
            if (busy) return;
            setBusy(true);
            try {
                const response = await fetch("/api/intake", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amountMl })
                });
                const body = await response.json();

                if (!response.ok) {
                    show(body.error ?? "Could not log that.", "error");
                    return;
                }

                await refresh();

                if (body.justHitGoal) {
                    setCelebration(Date.now());
                    setTimeout(() => setCelebration(0), 2600);
                    show(`Goal reached — ${body.rewards.streakCurrent} day streak 🔥`, "success");
                } else if (body.excessive) {
                    show("That is well past your goal. Easy does it 💙", "error");
                } else if (body.newBadges?.length) {
                    const badge = BADGE_BY_CODE.get(body.newBadges[0]);
                    show(`Badge unlocked: ${badge?.emoji ?? "🏅"} ${badge?.name ?? ""}`, "success");
                } else {
                    show(`Logged ${formatAmount(amountMl, unit)}`, "success");
                }
            } finally {
                setBusy(false);
            }
        },
        [busy, refresh, show, unit]
    );

    const undo = useCallback(async () => {
        const response = await fetch("/api/intake", { method: "DELETE" });
        if (!response.ok) {
            show("Nothing to undo.", "error");
            return;
        }
        await refresh();
        show("Removed the last entry.");
    }, [refresh, show]);

    // Register the worker and read the browser's push state. This is a genuine
    // subscription to an external system, so it belongs in an effect.
    useEffect(() => {
        let cancelled = false;
        void registerServiceWorker()
            .then(() => pushStatus(vapidKey || undefined))
            .then((status) => {
                if (!cancelled) setPush(status);
            });
        return () => {
            cancelled = true;
        };
    }, [vapidKey]);

    useEffect(() => {
        void adoptBrowserTimezone(initial.user.timezone);
    }, [initial.user.timezone]);

    // A log made from a notification action tells us to refresh.
    useEffect(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "intake-logged") void refresh();
        };
        navigator.serviceWorker.addEventListener("message", handler);
        return () => navigator.serviceWorker.removeEventListener("message", handler);
    }, [refresh]);

    async function turnOnReminders() {
        const result = await enablePush(vapidKey);
        if (!result.ok) {
            show(result.error ?? "Could not turn on reminders.", "error");
        } else {
            show("Reminders are on for this device 🔔", "success");
            await refresh();
        }
        setPush(await pushStatus(vapidKey || undefined));
    }

    const { today, rewards, user } = data;
    const remaining = Math.max(0, today.goalMl - today.totalMl);
    const presets = PRESETS[unit];

    return (
        <>
            <main className="shell">
                <header className="topbar">
                    <div className="greeting">
                        {greeting(today.minuteOfDay)}
                        <strong>{user.name || "there"}</strong>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                        <span className="ring-pct" title="Current streak">
                            🔥 {rewards.streakCurrent}
                        </span>
                        <span className="ring-pct" title={rewards.levelTitle}>
                            ⭐ Lv {rewards.level}
                        </span>
                    </div>
                </header>

                {push && (push.state === "prompt" || push.state === "needs-install" || push.state === "denied") && (
                    <div className={`banner${push.state === "prompt" ? "" : " warn"}`} style={{ marginBottom: 14 }}>
                        <span>🔔</span>
                        <div>
                            {push.detail}
                            {push.state === "prompt" && (
                                <div className="banner-actions">
                                    <button className="btn btn-sm btn-primary" onClick={turnOnReminders}>
                                        Turn on reminders
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <section className="card">
                    <Ring
                        totalMl={today.totalMl}
                        goalMl={today.goalMl}
                        pacedTargetMl={today.pacedTargetMl}
                        primaryLabel={formatAmount(today.totalMl, unit)}
                        goalLabel={formatAmount(today.goalMl, unit)}
                    />
                    <p className="center muted" style={{ marginTop: 10 }}>
                        {remaining > 0
                            ? `${formatAmount(remaining, unit)} to go today`
                            : "You are done for today — nice work 🎉"}
                    </p>
                </section>

                <section className="card">
                    <div className="card-title">Log a drink</div>
                    <div className="quick-grid">
                        {presets.map((preset) => (
                            <button
                                key={preset.amountMl}
                                className="quick"
                                disabled={busy}
                                onClick={() => log(preset.amountMl)}
                            >
                                <span className="quick-emoji">{preset.emoji}</span>
                                <span className="quick-amount">{preset.display}</span>
                            </button>
                        ))}
                    </div>

                    {customOpen ? (
                        <form
                            className="row"
                            style={{ marginTop: 12 }}
                            onSubmit={(event) => {
                                event.preventDefault();
                                const entered = Number(customValue);
                                if (!Number.isFinite(entered) || entered <= 0) return;
                                const ml = unit === "oz" ? Math.round(entered * ML_PER_OZ) : Math.round(entered);
                                void log(ml);
                                setCustomValue("");
                                setCustomOpen(false);
                            }}
                        >
                            <input
                                type="number"
                                min={1}
                                max={unit === "oz" ? 100 : 3000}
                                autoFocus
                                placeholder={`Amount in ${unit}`}
                                value={customValue}
                                onChange={(event) => setCustomValue(event.target.value)}
                            />
                            <button className="btn btn-primary btn-sm" type="submit">
                                Add
                            </button>
                        </form>
                    ) : (
                        <div className="row" style={{ marginTop: 12 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCustomOpen(true)}>
                                Custom amount
                            </button>
                            {today.logs.length > 0 && (
                                <button className="btn btn-ghost btn-sm" onClick={undo}>
                                    Undo last
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <section className="card">
                    <div className="card-title">Level {rewards.level} · {rewards.levelTitle}</div>
                    <div className="level-bar">
                        <div
                            className="level-fill"
                            style={{ width: `${Math.round((rewards.intoLevel / rewards.levelSpan) * 100)}%` }}
                        />
                    </div>
                    <div className="row-between" style={{ marginTop: 8 }}>
                        <span className="muted">{rewards.xp} XP total</span>
                        <span className="muted">
                            {rewards.levelSpan - rewards.intoLevel} XP to level {rewards.level + 1}
                        </span>
                    </div>
                </section>

                <section className="card">
                    <div className="card-title">Today&apos;s log</div>
                    {today.logs.length === 0 ? (
                        <p className="muted">Nothing yet. That first glass is right there 👆</p>
                    ) : (
                        today.logs.map((entry) => (
                            <div className="log-item" key={entry.id}>
                                <div className="log-main">
                                    <span>💧</span>
                                    <div>
                                        <div className="log-amount">{formatAmount(entry.amount_ml, unit)}</div>
                                        <div className="log-time">
                                            {new Date(entry.created_at).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={async () => {
                                        await fetch(`/api/intake?id=${entry.id}`, { method: "DELETE" });
                                        await refresh();
                                    }}
                                    aria-label="Remove entry"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </section>
            </main>

            {celebration > 0 && <Confetti seed={celebration} />}
            <Toast toast={toast} />
            <Nav />
        </>
    );
}

function greeting(minuteOfDay: number): string {
    if (minuteOfDay < 12 * 60) return "Good morning,";
    if (minuteOfDay < 17 * 60) return "Good afternoon,";
    return "Good evening,";
}
