"use client";

import { Eye, Fire, Star, X } from "@phosphor-icons/react";

import { useCallback, useState } from "react";
import Nav from "@/components/Nav";
import { Toast, useToast } from "@/components/Toast";
import { formatAmount } from "@/lib/goal";
import type { BuddySummary } from "@/lib/types";

interface Follower {
    id: string;
    name: string;
    created_at: string;
}

export default function BuddiesScreen({
    buddyCode: initialCode,
    initialBuddies,
    initialFollowers
}: {
    buddyCode: string;
    initialBuddies: BuddySummary[];
    initialFollowers: Follower[];
}) {
    const { toast, show } = useToast();
    const [buddyCode, setBuddyCode] = useState(initialCode);
    const [buddies, setBuddies] = useState<BuddySummary[]>(initialBuddies);
    const [followers, setFollowers] = useState<Follower[]>(initialFollowers);
    const [input, setInput] = useState("");

    const load = useCallback(async () => {
        const [buddyResponse, followerResponse] = await Promise.all([
            fetch("/api/buddy", { cache: "no-store" }),
            fetch("/api/buddy/followers", { cache: "no-store" })
        ]);
        if (buddyResponse.ok) {
            const body = (await buddyResponse.json()) as { buddies: BuddySummary[] };
            setBuddies(body.buddies);
        }
        if (followerResponse.ok) {
            const body = (await followerResponse.json()) as { followers: Follower[] };
            setFollowers(body.followers);
        }
    }, []);

    async function rotateCode() {
        const response = await fetch("/api/buddy/code", { method: "POST" });
        const body = await response.json();
        if (!response.ok) {
            show(body.error ?? "Could not change the code.", "error");
            return;
        }
        setBuddyCode(body.buddyCode);
        show("New code issued. The old one no longer works.", "success");
    }

    async function removeFollower(follower: Follower) {
        const response = await fetch(`/api/buddy/followers?id=${follower.id}`, { method: "DELETE" });
        if (!response.ok) {
            show("Could not remove them.", "error");
            return;
        }
        await load();
        show(`${follower.name} can no longer see your progress.`, "success");
    }

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
        show(`You are now following ${body.name}.`, "success");
    }

    async function nudge(buddy: BuddySummary) {
        const response = await fetch("/api/buddy/nudge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buddyId: buddy.id })
        });
        const body = await response.json();
        show(response.ok ? `Nudge sent to ${buddy.name}.` : body.error ?? "Could not send.", response.ok ? "success" : "error");
    }

    async function shareCode() {
        const text = `Join me on DrinkMoreWater. My buddy code is ${buddyCode}`;
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
                    <div className="code-value">{buddyCode || "·····"}</div>
                    <div className="row" style={{ gap: 8, marginTop: 14 }}>
                        <button className="btn btn-sm btn-ghost" onClick={shareCode}>
                            Share
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={rotateCode}>
                            New code
                        </button>
                    </div>
                    <p className="muted" style={{ marginTop: 10 }}>
                        Give this to someone so they can follow your progress. Issuing a new code
                        stops anyone who still has the old one from using it.
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

                <section className="section">
                    <div className="card-title">Following</div>
                    {buddies.length === 0 ? (
                        <p className="muted">
                            No buddies yet. Hydration is more fun with someone to beat.
                        </p>
                    ) : (
                        buddies.map((buddy) => {
                            const percent = Math.min(100, Math.round((buddy.today_ml / buddy.goal_ml) * 100));
                            const daysHit = buddy.week.filter((dayMl) => dayMl >= buddy.goal_ml).length;
                            return (
                                <div key={buddy.id} className="log-item" style={{ display: "block", padding: "12px 0" }}>
                                    <div className="row-between">
                                        <div>
                                            <div style={{ fontWeight: 650 }}>{buddy.name}</div>
                                            <div className="muted">
                                                {formatAmount(buddy.today_ml, buddy.unit)} of{" "}
                                                {formatAmount(buddy.goal_ml, buddy.unit)}
                                                <span className="inline-stat" role="img" aria-label={`${buddy.streak_current} day streak`}>
                                                    <Fire size={13} weight="fill" aria-hidden="true" />
                                                    {buddy.streak_current}
                                                </span>
                                                <span className="inline-stat" role="img" aria-label={`Level ${buddy.level}`}>
                                                    <Star size={13} weight="fill" aria-hidden="true" />
                                                    Lv {buddy.level}
                                                </span>
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
                                                <X size={13} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        className="week-row"
                                        role="img"
                                        aria-label={`${daysHit} of the last 7 days hit, today ${percent}% of goal`}
                                    >
                                        {buddy.week.map((dayMl, index) => {
                                            const fraction =
                                                buddy.goal_ml > 0 ? Math.min(1, dayMl / buddy.goal_ml) : 0;
                                            return (
                                                <div
                                                    key={index}
                                                    className={`week-day${fraction >= 1 ? " hit" : ""}`}
                                                >
                                                    {dayMl > 0 && (
                                                        <span
                                                            style={{ height: `${Math.round(fraction * 100)}%` }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>
                <section className="section">
                    <div className="card-title">Following you · {followers.length}</div>
                    {followers.length === 0 ? (
                        <p className="muted">
                            Nobody is following you. Anyone you add here can see today&apos;s
                            progress and send you a nudge.
                        </p>
                    ) : (
                        followers.map((follower) => (
                            <div className="log-item" key={follower.id}>
                                <div className="log-main">
                                    <Eye size={18} weight="fill" style={{ flex: "0 0 auto", marginTop: 1 }} />
                                    <div>
                                        <div className="log-amount">{follower.name}</div>
                                        <div className="log-time">
                                            since {new Date(follower.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm btn-ghost btn-danger"
                                    onClick={() => removeFollower(follower)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}
                    <p className="muted" style={{ marginTop: 10 }}>
                        Removing someone also stops them adding you again.
                    </p>
                </section>
            </main>
            <Toast toast={toast} />
            <Nav />
        </>
    );
}
