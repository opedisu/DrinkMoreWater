import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";

export default async function LandingPage() {
    if (await currentUserId()) redirect("/app");

    return (
        <main className="hero">
            <div className="hero-drop">💧</div>
            <h1>Drink More Water</h1>
            <p className="lede">
                A daily water goal that fits you, reminders that actually arrive, and a streak
                you will not want to break.
            </p>

            <Link href="/login" className="btn btn-primary">
                Get started — it is free
            </Link>

            <div className="feature-list">
                <div className="feature">
                    <span className="feature-emoji">🔔</span>
                    <div>
                        <strong>Reminders that reach you</strong>
                        <span className="muted">
                            Real push notifications, sent on a schedule from the server — they arrive
                            even when the app is closed and your phone is locked.
                        </span>
                    </div>
                </div>
                <div className="feature">
                    <span className="feature-emoji">🧠</span>
                    <div>
                        <strong>Smart, not naggy</strong>
                        <span className="muted">
                            Nudges only when you are behind pace, only inside your waking hours, and
                            never once you have hit the goal.
                        </span>
                    </div>
                </div>
                <div className="feature">
                    <span className="feature-emoji">🔥</span>
                    <div>
                        <strong>Streaks, levels and badges</strong>
                        <span className="muted">
                            Earn XP for every glass, keep a streak alive, and collect badges for the
                            milestones that matter.
                        </span>
                    </div>
                </div>
                <div className="feature">
                    <span className="feature-emoji">💞</span>
                    <div>
                        <strong>Bring someone with you</strong>
                        <span className="muted">
                            Share a buddy code to see each other&apos;s progress and send a nudge when
                            they are falling behind.
                        </span>
                    </div>
                </div>
            </div>

            <p className="muted" style={{ marginTop: 32, fontSize: 12 }}>
                Not medical advice. If a doctor has given you a fluid target, follow theirs.
            </p>
        </main>
    );
}
