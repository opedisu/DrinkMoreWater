"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount, recommendedGoalMl } from "@/lib/goal";
import { formatMinute, parseMinute } from "@/lib/time";
import type { ActivityLevel } from "@/lib/types";

const ACTIVITY_LABELS: { value: ActivityLevel; label: string }[] = [
    { value: "low", label: "Mostly seated" },
    { value: "moderate", label: "Some exercise" },
    { value: "high", label: "Very active" }
];

export default function Onboarding({ initialName }: { initialName: string }) {
    const router = useRouter();

    const [name, setName] = useState(initialName);
    const [weight, setWeight] = useState("65");
    const [activity, setActivity] = useState<ActivityLevel>("moderate");
    const [hotClimate, setHotClimate] = useState(true);
    const [wake, setWake] = useState("07:00");
    const [sleep, setSleep] = useState("23:00");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const goalMl = useMemo(() => {
        const weightKg = Number(weight);
        return recommendedGoalMl(Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null, activity, hotClimate);
    }, [weight, activity, hotClimate]);

    async function save() {
        const weightKg = Number(weight);
        if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 300) {
            setError("Enter a weight between 25 and 300 kg.");
            return;
        }

        setSaving(true);
        setError("");

        const response = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                weightKg,
                activityLevel: activity,
                hotClimate,
                autoGoal: true,
                wakeMinute: parseMinute(wake, 420),
                sleepMinute: parseMinute(sleep, 1380),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })
        });

        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "Could not save. Try again.");
            setSaving(false);
            return;
        }

        router.replace("/app");
    }

    return (
        <main className="shell" style={{ paddingBottom: 40 }}>
            <header style={{ marginBottom: 22 }}>
                <h1 style={{ fontSize: 26 }}>Let&apos;s set your goal</h1>
                <p className="muted" style={{ marginTop: 6 }}>
                    Four quick answers. You can change any of this later.
                </p>
            </header>

            <div className="card stack">
                <div className="field">
                    <label htmlFor="name">What should we call you?</label>
                    <input
                        id="name"
                        value={name}
                        maxLength={40}
                        placeholder="Your name"
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>

                <div className="field">
                    <label htmlFor="weight">Your weight (kg)</label>
                    <input
                        id="weight"
                        type="number"
                        inputMode="decimal"
                        min={25}
                        max={300}
                        value={weight}
                        onChange={(event) => setWeight(event.target.value)}
                    />
                </div>

                <div className="field">
                    <label>How active are you?</label>
                    <div className="seg">
                        {ACTIVITY_LABELS.map((option) => (
                            <button
                                key={option.value}
                                className={activity === option.value ? "active" : ""}
                                onClick={() => setActivity(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="row-between">
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Hot climate</div>
                        <div className="muted">Adds a little extra to your target.</div>
                    </div>
                    <button
                        className={`toggle${hotClimate ? " on" : ""}`}
                        aria-pressed={hotClimate}
                        aria-label="Hot climate"
                        onClick={() => setHotClimate((value) => !value)}
                    />
                </div>

                <div className="field-row">
                    <div className="field">
                        <label htmlFor="wake">Usually awake from</label>
                        <input id="wake" type="time" value={wake} onChange={(event) => setWake(event.target.value)} />
                    </div>
                    <div className="field">
                        <label htmlFor="sleep">Until</label>
                        <input id="sleep" type="time" value={sleep} onChange={(event) => setSleep(event.target.value)} />
                    </div>
                </div>
            </div>

            <div className="card center">
                <div className="card-title">Your daily goal</div>
                <div className="goal-preview">{formatAmount(goalMl, "ml")}</div>
                <p className="muted" style={{ marginTop: 6 }}>
                    Based on 35 ml per kg, plus your activity and climate.
                </p>
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>{error}</p>}

            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : "Start tracking"}
            </button>

            <p className="muted center" style={{ marginTop: 16, fontSize: 12 }}>
                Reminders will stay inside {formatMinute(parseMinute(wake, 420))} -{" "}
                {formatMinute(parseMinute(sleep, 1380))}.
            </p>
        </main>
    );
}
