import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRinging, Drop, Fire, Sparkle, UsersThree } from "@phosphor-icons/react/ssr";
import { currentUserId } from "@/lib/session";

const FEATURES = [
    {
        Glyph: BellRinging,
        title: "Reminders that reach you",
        body: "Real push notifications, sent on a schedule from the server. They arrive even when the app is closed and your phone is locked."
    },
    {
        Glyph: Sparkle,
        title: "Smart, not naggy",
        body: "Nudges only when you are behind pace, only inside your waking hours, and never once you have hit the goal."
    },
    {
        Glyph: Fire,
        title: "Streaks, levels and badges",
        body: "Earn XP for every glass, keep a streak alive, and collect badges for the milestones that matter."
    },
    {
        Glyph: UsersThree,
        title: "Bring someone with you",
        body: "Share a buddy code to see each other's progress and send a nudge when they are falling behind."
    }
];

export default async function LandingPage() {
    if (await currentUserId()) redirect("/app");

    return (
        <main className="hero">
            <div className="hero-mark" aria-hidden="true">
                <Drop size={34} weight="fill" />
            </div>
            <h1>Drink More Water</h1>
            <p className="lede">
                A daily water goal that fits you, reminders that actually arrive, and a streak you
                will not want to break.
            </p>

            <Link href="/login" className="btn btn-primary">
                Get started
            </Link>

            <div className="feature-list">
                {FEATURES.map(({ Glyph, title, body }) => (
                    <div className="feature" key={title}>
                        <span className="feature-icon" aria-hidden="true">
                            <Glyph size={20} weight="duotone" />
                        </span>
                        <div>
                            <strong>{title}</strong>
                            <span className="muted">{body}</span>
                        </div>
                    </div>
                ))}
            </div>

            <p className="muted" style={{ marginTop: 32, fontSize: 12 }}>
                Not medical advice. If a doctor has given you a fluid target, follow theirs.
            </p>
        </main>
    );
}
