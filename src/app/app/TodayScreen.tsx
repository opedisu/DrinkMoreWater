"use client";

import { useCallback, useEffect, useState } from "react";
import {
    BeerBottle,
    Bell,
    BellSlash,
    Coffee,
    Drop,
    Fire,
    Jar,
    PintGlass,
    Star,
    X,
    type Icon
} from "@phosphor-icons/react";
import Nav from "@/components/Nav";
import InstallGuide from "@/components/InstallGuide";
import Vessel from "@/components/Vessel";
import Confetti from "@/components/Confetti";
import { Toast, useToast } from "@/components/Toast";
import { adoptBrowserTimezone, useSnapshot } from "@/lib/useMe";
import type { Snapshot } from "@/lib/snapshot";
import { formatAmount, ML_PER_OZ } from "@/lib/goal";
import { BADGE_BY_CODE } from "@/lib/progression";
import { DRINKS, DRINK_LABELS, hydratingMl, hydrationOf } from "@/lib/drinks";
import { playDrop, playGoal, playRemove } from "@/lib/sounds";
import { formatClock, formatMinute, parseMinute } from "@/lib/time";
import { enablePush, pushStatus, registerServiceWorker, type PushStatus } from "@/lib/pushClient";
import type { Unit } from "@/lib/types";

// Round numbers in whichever unit the user reads, not converted oddities.
// The glyph escalates with volume, so size is readable before the label is.
const PRESETS: Record<Unit, { amountMl: number; display: string; Glyph: Icon }[]> = {
    ml: [
        { amountMl: 150, display: "150 ml", Glyph: Coffee },
        { amountMl: 250, display: "250 ml", Glyph: PintGlass },
        { amountMl: 500, display: "500 ml", Glyph: BeerBottle },
        { amountMl: 750, display: "750 ml", Glyph: Jar }
    ],
    oz: [
        { amountMl: Math.round(6 * ML_PER_OZ), display: "6 oz", Glyph: Coffee },
        { amountMl: Math.round(8 * ML_PER_OZ), display: "8 oz", Glyph: PintGlass },
        { amountMl: Math.round(16 * ML_PER_OZ), display: "16 oz", Glyph: BeerBottle },
        { amountMl: Math.round(24 * ML_PER_OZ), display: "24 oz", Glyph: Jar }
    ]
};

// Only glyphs the presets already use, so the log list and the quick grid
// speak the same visual language.
const DRINK_GLYPH: Record<string, Icon> = {
    water: Drop,
    sparkling: BeerBottle,
    tea: Coffee,
    coffee: Coffee,
    juice: PintGlass,
    other: Jar
};

function DrinkIcon({ drink }: { drink: string }) {
    const Glyph = DRINK_GLYPH[drink] ?? Drop;
    return <Glyph size={17} weight="fill" />;
}

export default function TodayScreen({ initial, vapidKey }: { initial: Snapshot; vapidKey: string }) {
    const { data, refresh } = useSnapshot(initial);
    const { toast, show } = useToast();
    const [celebration, setCelebration] = useState(0);
    const [busy, setBusy] = useState(false);
    const [push, setPush] = useState<PushStatus | null>(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [customValue, setCustomValue] = useState("");
    const [customDrink, setCustomDrink] = useState("water");
    const [customTime, setCustomTime] = useState("");

    const unit: Unit = data.user.unit;

    const log = useCallback(
        async (amountMl: number, drink = "water", atMinute: number | null = null) => {
            if (busy) return;
            setBusy(true);
            try {
                const response = await fetch("/api/intake", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amountMl, drink, atMinute })
                });
                const body = await response.json();

                if (!response.ok) {
                    show(body.error ?? "Could not log that.", "error");
                    return;
                }

                await refresh();

                // A short tap is most of what makes a web app feel native on a
                // phone. Unsupported on iOS Safari, where it is simply absent.
                navigator.vibrate?.(body.justHitGoal ? [18, 60, 18, 60, 36] : 12);
                if (body.justHitGoal) playGoal();
                else playDrop();

                if (body.justHitGoal) {
                    setCelebration(Date.now());
                    setTimeout(() => setCelebration(0), 2600);
                    show(
                        body.streakRepaired
                            ? `Streak saved. ${body.rewards.streakCurrent} days, one missed day forgiven.`
                            : `Goal reached. ${body.rewards.streakCurrent} day streak.`,
                        "success"
                    );
                } else if (body.excessive) {
                    show("That is well past your goal. Easy does it.", "error");
                } else if (body.newBadges?.length) {
                    const badge = BADGE_BY_CODE.get(body.newBadges[0]);
                    show(`Badge unlocked: ${badge?.name ?? "a new badge"}`, "success");
                } else {
                    // What the server stored, not what was asked for: it falls
                    // back to water for anything it does not recognise.
                    const stored = body.intake?.drink ?? drink;
                    const label = DRINK_LABELS.get(stored)?.toLowerCase();
                    const what =
                        stored === "water" || !label
                            ? formatAmount(amountMl, unit)
                            : `${formatAmount(amountMl, unit)} of ${label}`;
                    // Say so at the moment the expectation forms, not later.
                    const counted = hydratingMl(amountMl, stored);
                    const against = counted === amountMl ? "" : `, ${formatAmount(counted, unit)} counted`;
                    const when = atMinute === null ? "" : ` at ${formatMinute(atMinute)}`;
                    show(`Logged ${what}${when}${against}`, "success");
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
        playRemove();
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
            show("Reminders are on for this device.", "success");
            await refresh();
        }
        setPush(await pushStatus(vapidKey || undefined));
    }

    const { today, rewards, user } = data;

    // Reminders failing silently is the worst thing that can happen to this
    // app, so say so on the main screen rather than letting it go unnoticed.
    const reminderHealth =
        push?.state === "enabled" && user.remindersOn ? staleReminderWarning(user.lastRemindAt) : null;
    const remaining = Math.max(0, today.goalMl - today.totalMl);

    // Pace moved out of the vessel when the readout did: the vessel is now
    // purely the picture, and the words sit beside it.
    const percent = today.goalMl > 0 ? Math.round(Math.min(1, today.totalMl / today.goalMl) * 100) : 0;
    const goalMet = today.totalMl >= today.goalMl;
    const behindPace = !goalMet && today.totalMl < today.pacedTargetMl - 100;
    const paceClass = goalMet ? "done" : behindPace ? "behind" : "";
    const paceText = goalMet
        ? "Goal reached"
        : `${percent}% \u00b7 ${behindPace ? "behind pace" : "on track"}`;
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
                        <span className="pill" role="img" aria-label={`${rewards.streakCurrent} day streak`}>
                            <Fire size={14} weight="fill" aria-hidden="true" />
                            <span className="pill-num">{rewards.streakCurrent}</span>
                        </span>
                        <span className="pill" role="img" aria-label={`Level ${rewards.level}, ${rewards.levelTitle}`}>
                            <Star size={14} weight="fill" aria-hidden="true" />
                            <span className="pill-num">Lv {rewards.level}</span>
                        </span>
                    </div>
                </header>

                <div className="notices">
                    {/* Installing comes first on iOS; the guide hides itself once done. */}
                    <InstallGuide />

                {push && (push.state === "prompt" || push.state === "denied") && (
                    <div className={`banner${push.state === "prompt" ? "" : " warn"}`}>
                        <Bell size={18} weight="fill" />
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

                {reminderHealth && (
                    <div className="banner warn">
                        <BellSlash size={18} weight="fill" />
                        <div>{reminderHealth}</div>
                    </div>
                )}

                </div>

                <section className="today-hero reveal">
                    <div className="today-readout">
                        <div className="today-total">{formatAmount(today.totalMl, unit)}</div>
                        <div className="today-goal">of {formatAmount(today.goalMl, unit)}</div>
                        <span className={`pill ${paceClass}`}>{paceText}</span>
                        <p className="today-remaining">
                            {remaining > 0
                                ? `${formatAmount(remaining, unit)} to go today`
                                : "You are done for today. Nice work."}
                        </p>
                    </div>
                    <Vessel totalMl={today.totalMl} goalMl={today.goalMl} />
                </section>

                <section className="card reveal" style={{ animationDelay: "60ms" }}>
                    <div className="card-title">Log a drink</div>
                    <div className="quick-grid">
                        {presets.map((preset) => (
                            <button
                                key={preset.amountMl}
                                className="quick"
                                disabled={busy}
                                onClick={() => log(preset.amountMl)}
                                aria-label={`Log ${preset.display}`}
                            >
                                <span className="quick-icon">
                                    <preset.Glyph size={24} weight="duotone" />
                                </span>
                                <span className="quick-amount">{preset.display}</span>
                            </button>
                        ))}
                    </div>

                    {customOpen ? (
                        <form
                            className="stack"
                            style={{ marginTop: 14 }}
                            onSubmit={(event) => {
                                event.preventDefault();
                                const entered = Number(customValue);
                                if (!Number.isFinite(entered) || entered <= 0) return;
                                const ml = unit === "oz" ? Math.round(entered * ML_PER_OZ) : Math.round(entered);
                                const minute = customTime ? parseMinute(customTime, -1) : -1;
                                void log(ml, customDrink, minute < 0 ? null : minute);
                                setCustomValue("");
                                setCustomTime("");
                                setCustomDrink("water");
                                setCustomOpen(false);
                            }}
                        >
                            <div className="field">
                                <label htmlFor="custom-amount">Amount in {unit}</label>
                                <input
                                    id="custom-amount"
                                    type="number"
                                    min={1}
                                    max={unit === "oz" ? 100 : 3000}
                                    autoFocus
                                    value={customValue}
                                    onChange={(event) => setCustomValue(event.target.value)}
                                />
                            </div>

                            <div className="field-row field-row-times">
                                <div className="field">
                                    <label htmlFor="custom-drink">Drink</label>
                                    <select
                                        id="custom-drink"
                                        value={customDrink}
                                        onChange={(event) => setCustomDrink(event.target.value)}
                                    >
                                        {DRINKS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.hydration < 1
                                                    ? `${option.label} · counts ${Math.round(option.hydration * 100)}%`
                                                    : option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label htmlFor="custom-time">Time (now if blank)</label>
                                    <input
                                        id="custom-time"
                                        type="time"
                                        max={formatMinute(today.minuteOfDay)}
                                        value={customTime}
                                        onChange={(event) => setCustomTime(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="row">
                                <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
                                    Add
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    type="button"
                                    onClick={() => setCustomOpen(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="row" style={{ marginTop: 12 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCustomOpen(true)}>
                                Add in detail
                            </button>
                            {today.logs.length > 0 && (
                                <button className="btn btn-ghost btn-sm" onClick={undo}>
                                    Undo last
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <section className="section reveal" style={{ animationDelay: "120ms" }}>
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

                <section className="section reveal" style={{ animationDelay: "180ms" }}>
                    <div className="card-title">Today&apos;s log</div>
                    {today.logs.length === 0 ? (
                        <p className="muted">Nothing yet. The first glass is one tap away.</p>
                    ) : (
                        today.logs.map((entry) => (
                            <div className="log-item" key={entry.id}>
                                <div className="log-main">
                                    <span className="log-icon">
                                        <DrinkIcon drink={entry.drink} />
                                    </span>
                                    <div>
                                        <div className="log-amount">
                                            {formatAmount(entry.amount_ml, unit)}
                                            {hydrationOf(entry.drink) < 1 && (
                                                <span className="log-counted">
                                                    {`· ${formatAmount(hydratingMl(entry.amount_ml, entry.drink), unit)} counted`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="log-time">
                                            {formatClock(user.timezone, new Date(entry.created_at))}
                                            {entry.drink !== "water" &&
                                                ` · ${DRINK_LABELS.get(entry.drink) ?? entry.drink}`}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={async () => {
                                        await fetch(`/api/intake?id=${entry.id}`, { method: "DELETE" });
                                        await refresh();
                                        playRemove();
                                    }}
                                    aria-label={`Remove ${formatAmount(entry.amount_ml, unit)} entry`}
                                >
                                    <X size={14} weight="bold" />
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

/**
 * Warns only when reminders have genuinely stopped, in words the reader can
 * act on.
 *
 * It used to fire the moment reminders were switched on, because none had
 * been sent yet, which is the normal state for everyone on their first day.
 * It also told them to check the scheduler, which is an instruction for
 * whoever runs the server. Whether the sweep is alive belongs in
 * /api/health, where it already is.
 */
function staleReminderWarning(lastRemindAt: string | null): string | null {
    // Never nudged yet is not a fault, it is a new account.
    if (!lastRemindAt) return null;

    const hours = (Date.now() - new Date(lastRemindAt).getTime()) / 3_600_000;
    if (hours < 48) return null;

    const days = Math.floor(hours / 24);
    return `No reminder has arrived for ${days} days. Check that notifications are still allowed for this app.`;
}
