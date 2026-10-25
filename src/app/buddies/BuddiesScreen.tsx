"use client";

import { useCallback, useState } from "react";
import Nav from "@/components/Nav";
import { Toast, useToast } from "@/components/Toast";
import { formatAmount } from "@/lib/goal";
import type { BuddySummary } from "@/lib/types";

export default function BuddiesScreen({
    buddyCode,
    initialBuddies
}: {
    buddyCode: string;
    initialBuddies: BuddySummary[];
}) {
    const { toast, show } = useToast();
    const [buddies, setBuddies] = useState<BuddySummary[]>(initialBuddies);
    const [input, setInput] = useState("");

    const load = useCallback(async () => {
        const response = await fetch("/api/buddy", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { buddyCode: string; buddies: BuddySummary[] };
        setBuddies(body.buddies);
    }, []);

    async function addBuddy(event: React.FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/buddy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: input })
        });
        const body = await response.json();

        if (!response.ok) {
            show(body.error ?? "Could not add that buddy.", "error");
            return;
        }
        setInput("");
        await load();
        show(`You are now following ${body.name} 💞`, "success");
    }

    async function nudge(buddy: BuddySummary) {
        const response = await fetch("/api/buddy/nudge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buddyId: buddy.id })
        });
        const body = await response.json();
        show(response.ok ? `Nudge sent to ${buddy.name} 💧` : body.error ?? "Could not send.", response.ok ? "success" : "error");
    }

    async function shareCode() {
        const text = `Join me on DrinkMoreWater — my buddy code is ${buddyCode}`;
        if (navigator.share) {
            await navigator.share({ title: "DrinkMoreWater", text }).catch(() => undefined);
            return;
        }
        await navigator.clipboard.writeText(buddyCode);
        show("Code copied to clipboard.", "success");
    }

    return (
        <>
            <main className="shell">
                <header className="topbar">
                    <div className="greeting">
                        Keep each other honest
                        <strong>Buddies</strong>
                    </div>
                </header>

                <section className="card">
                    <div className="card-title">Your buddy code</div>
                    <div className="row-between">
                        <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: "0.12em" }}>
                            {buddyCode || "·····"}
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={shareCode}>
                            Share
                        </button>
                    </div>
                    <p className="muted" style={{ marginTop: 10 }}>
                        Give this to someone so they can follow your progress. Ask for theirs to
                        follow them back.
                    </p>
                </section>

                <section className="card">
                    <div className="card-title">Add a buddy</div>
                    <form className="row" onSubmit={addBuddy}>
                        <input
                            placeholder="Their code"
                            value={input}
                            maxLength={12}
                            autoCapitalize="characters"
                            onChange={(event) => setInput(event.target.value.toUpperCase())}
                        />
                        <button className="btn btn-primary btn-sm" type="submit" disabled={input.length < 4}>
                            Add
                        </button>
                    </form>
                </section>

                <section className="card">
                    <div className="card-title">Following</div>
                    {buddies.length === 0 ? (
                        <p className="muted">
                            No buddies yet. Hydration is more fun with someone to beat 😄
                        </p>
                    ) : (
                        buddies.map((buddy) => {
                            const percent = Math.min(100, Math.round((buddy.today_ml / buddy.goal_ml) * 100));
                            return (
                                <div key={buddy.id} className="log-item" style={{ display: "block", padding: "12px 0" }}>
                                    <div className="row-between">
                                        <div>
                                            <div style={{ fontWeight: 650 }}>{buddy.name}</div>
                                            <div className="muted">
                                                {formatAmount(buddy.today_ml, buddy.unit)} of{" "}
                                                {formatAmount(buddy.goal_ml, buddy.unit)} · 🔥 {buddy.streak_current} · ⭐ Lv{" "}
                                                {buddy.level}
                                            </div>
                                        </div>
                                        <div className="row" style={{ gap: 6 }}>
                                            <button className="btn btn-sm btn-ghost" onClick={() => nudge(buddy)}>
                                                Nudge
                                            </button>
                                            <button
                                                className="btn btn-sm btn-ghost btn-danger"
                                                aria-label={`Unfollow ${buddy.name}`}
                                                onClick={async () => {
                                                    await fetch(`/api/buddy?id=${buddy.id}`, { method: "DELETE" });
                                                    await load();
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    <div className="level-bar" style={{ marginTop: 9 }}>
                                        <div className="level-fill" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>
            </main>
            <Toast toast={toast} />
            <Nav />
        </>
    );
}
