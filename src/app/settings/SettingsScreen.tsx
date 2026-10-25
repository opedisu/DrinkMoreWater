"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { Toast, useToast } from "@/components/Toast";
import { useSnapshot } from "@/lib/useMe";
import type { Snapshot } from "@/lib/snapshot";
import { formatAmount, recommendedGoalMl } from "@/lib/goal";
import { formatMinute, parseMinute } from "@/lib/time";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/pushClient";
import type { ActivityLevel, Unit } from "@/lib/types";

const INTERVALS = [30, 45, 60, 90, 120, 180];
const ACTIVITY: { value: ActivityLevel; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "moderate", label: "Moderate" },
    { value: "high", label: "High" }
];

export default function SettingsScreen({ initial, vapidKey }: { initial: Snapshot; vapidKey: string }) {
    const router = useRouter();
    const { data, refresh } = useSnapshot(initial);
    const { toast, show } = useToast();

    const [form, setForm] = useState(() => formFrom(initial));
    const [saving, setSaving] = useState(false);
    const [push, setPush] = useState<PushStatus | null>(null);

    // Reading the browser's push permission is a subscription to an external
    // system, so it belongs in an effect.
    useEffect(() => {
        let cancelled = false;
        void pushStatus(vapidKey || undefined).then((status) => {
            if (!cancelled) setPush(status);
        });
        return () => {
            cancelled = true;
        };
    }, [vapidKey]);

    async function save(overrides: Partial<{ autoGoal: boolean }> = {}) {
        setSaving(true);
        const response = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.name,
                unit: form.unit,
                goalMl: form.goalMl,
                weightKg: form.weightKg === "" ? null : Number(form.weightKg),
                activityLevel: form.activityLevel,
                hotClimate: form.hotClimate,
                remindersOn: form.remindersOn,
                smartPacing: form.smartPacing,
                wakeMinute: parseMinute(form.wake, 420),
                sleepMinute: parseMinute(form.sleep, 1380),
                intervalMinutes: form.intervalMinutes,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ...overrides
            })
        });
        const body = await response.json();
        setSaving(false);

        if (!response.ok) {
            show(body.error ?? "Could not save.", "error");
            return;
        }
        if (overrides.autoGoal) {
            setForm((current) => ({ ...current, goalMl: body.goalMl }));
        }
        await refresh();
        show("Saved.", "success");
    }

    async function toggleReminders() {
        if (push?.state === "enabled") {
            await disablePush();
            setForm((current) => ({ ...current, remindersOn: false }));
            await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ remindersOn: false })
            });
            show("Reminders turned off on this device.");
        } else {
            const result = await enablePush(vapidKey);
            show(result.ok ? "Reminders are on 🔔" : result.error ?? "Could not enable.", result.ok ? "success" : "error");
        }
        setPush(await pushStatus(vapidKey || undefined));
        await refresh();
    }

    const recommended = recommendedGoalMl(
        form.weightKg === "" ? null : Number(form.weightKg),
        form.activityLevel,
        form.hotClimate
    );

    return (
        <>
            <main className="shell">
                <header className="topbar">
                    <div className="greeting">
                        {data.user.email}
                        <strong>Settings</strong>
                    </div>
                </header>

                <section className="card stack">
                    <div className="card-title">Reminders</div>

                    {push && push.state !== "enabled" && push.state !== "prompt" && (
                        <div className="banner warn">
                            <span>⚠️</span>
                            <div>{push.detail}</div>
                        </div>
                    )}

                    <div className="row-between">
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Push on this device</div>
                            <div className="muted">
                                {push?.state === "enabled" ? "On — nudges will arrive here." : "Off"}
                            </div>
                        </div>
                        <button
                            className={`toggle${push?.state === "enabled" ? " on" : ""}`}
                            aria-pressed={push?.state === "enabled"}
                            aria-label="Push reminders"
                            onClick={toggleReminders}
                        />
                    </div>

                    <div className="row-between">
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Only when behind</div>
                            <div className="muted">Skip the nudge if you are ahead of pace.</div>
                        </div>
                        <button
                            className={`toggle${form.smartPacing ? " on" : ""}`}
                            aria-pressed={form.smartPacing}
                            aria-label="Smart pacing"
                            onClick={() => setForm((c) => ({ ...c, smartPacing: !c.smartPacing }))}
                        />
                    </div>

                    <div className="field">
                        <label>Nudge me every</label>
                        <select
                            value={form.intervalMinutes}
                            onChange={(event) => setForm((c) => ({ ...c, intervalMinutes: Number(event.target.value) }))}
                        >
                            {INTERVALS.map((minutes) => (
                                <option key={minutes} value={minutes}>
                                    {formatInterval(minutes)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="wake">Awake from</label>
                            <input
                                id="wake"
                                type="time"
                                value={form.wake}
                                onChange={(event) => setForm((c) => ({ ...c, wake: event.target.value }))}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="sleep">Until</label>
                            <input
                                id="sleep"
                                type="time"
                                value={form.sleep}
                                onChange={(event) => setForm((c) => ({ ...c, sleep: event.target.value }))}
                            />
                        </div>
                    </div>

                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                            const response = await fetch("/api/push/test", { method: "POST" });
                            const body = await response.json();
                            show(response.ok ? "Test notification sent." : body.error ?? "Could not send.", response.ok ? "success" : "error");
                        }}
                    >
                        Send a test notification
                    </button>
                </section>

                <section className="card stack">
                    <div className="card-title">Your goal</div>

                    <div className="field">
                        <label htmlFor="goal">Daily target (ml)</label>
                        <input
                            id="goal"
                            type="number"
                            min={1200}
                            max={5000}
                            step={50}
                            value={form.goalMl}
                            onChange={(event) => setForm((c) => ({ ...c, goalMl: Number(event.target.value) }))}
                        />
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="weight">Weight (kg)</label>
                            <input
                                id="weight"
                                type="number"
                                inputMode="decimal"
                                min={25}
                                max={300}
                                value={form.weightKg}
                                onChange={(event) => setForm((c) => ({ ...c, weightKg: event.target.value }))}
                            />
                        </div>
                        <div className="field">
                            <label>Units</label>
                            <div className="seg">
                                {(["ml", "oz"] as Unit[]).map((unit) => (
                                    <button
                                        key={unit}
                                        className={form.unit === unit ? "active" : ""}
                                        onClick={() => setForm((c) => ({ ...c, unit }))}
                                    >
                                        {unit}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="field">
                        <label>Activity level</label>
                        <div className="seg">
                            {ACTIVITY.map((option) => (
                                <button
                                    key={option.value}
                                    className={form.activityLevel === option.value ? "active" : ""}
                                    onClick={() => setForm((c) => ({ ...c, activityLevel: option.value }))}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="row-between">
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Hot climate</div>
                            <div className="muted">Adds 400 ml to the recommendation.</div>
                        </div>
                        <button
                            className={`toggle${form.hotClimate ? " on" : ""}`}
                            aria-pressed={form.hotClimate}
                            aria-label="Hot climate"
                            onClick={() => setForm((c) => ({ ...c, hotClimate: !c.hotClimate }))}
                        />
                    </div>

                    {recommended !== form.goalMl && (
                        <button className="btn btn-ghost btn-sm" onClick={() => save({ autoGoal: true })}>
                            Use recommended: {formatAmount(recommended, "ml")}
                        </button>
                    )}
                </section>

                <section className="card stack">
                    <div className="card-title">Profile</div>
                    <div className="field">
                        <label htmlFor="name">Display name</label>
                        <input
                            id="name"
                            maxLength={40}
                            value={form.name}
                            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                        />
                    </div>
                    <p className="muted">Timezone: {data.user.timezone}</p>
                </section>

                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => save()} disabled={saving}>
                    {saving ? <span className="spinner" /> : "Save changes"}
                </button>

                <button
                    className="btn btn-ghost btn-danger"
                    style={{ marginTop: 10 }}
                    onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        router.replace("/");
                    }}
                >
                    Sign out
                </button>

                <p className="muted center" style={{ marginTop: 20, fontSize: 12 }}>
                    DrinkMoreWater is not medical advice. If you have a heart, kidney or fluid-restriction
                    condition, follow the target your doctor gave you.
                </p>
            </main>
            <Toast toast={toast} />
            <Nav />
        </>
    );
}

function formatInterval(minutes: number): string {
    if (minutes % 60 !== 0) return `${minutes} minutes`;
    const hours = minutes / 60;
    return `${hours} hour${hours > 1 ? "s" : ""}`;
}

function formFrom(snapshot: Snapshot) {
    return {
        name: snapshot.user.name,
        unit: snapshot.user.unit,
        goalMl: snapshot.user.goalMl,
        weightKg: snapshot.user.weightKg === null ? "" : String(snapshot.user.weightKg),
        activityLevel: snapshot.user.activityLevel,
        hotClimate: snapshot.user.hotClimate,
        remindersOn: snapshot.user.remindersOn,
        smartPacing: snapshot.user.smartPacing,
        wake: formatMinute(snapshot.user.wakeMinute),
        sleep: formatMinute(snapshot.user.sleepMinute),
        intervalMinutes: snapshot.user.intervalMinutes
    };
}
