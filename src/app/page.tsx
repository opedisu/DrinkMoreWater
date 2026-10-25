import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRinging, Fire, Sparkle, UsersThree } from "@phosphor-icons/react/ssr";
import LandingHero from "@/components/LandingHero";
import PageWater from "@/components/PageWater";
import { currentUserId } from "@/lib/session";

export default async function LandingPage() {
    if (await currentUserId()) redirect("/app");

    return (
        <>
            <PageWater />
            <main className="lp">
            <section className="lp-hero">
                <div className="lp-copy">
                    <h1>
                        Water you
                        <br />
                        actually drink.
                    </h1>
                    <p className="lede">
                        A goal sized to you, reminders that arrive with the app closed, and a streak
                        worth keeping.
                    </p>
                    <Link href="/login" className="btn btn-primary lp-cta">
                        Get started
                    </Link>
                </div>

                {/* The real components, filling on arrival, not a mock. */}
                <div className="lp-visual">
                    <LandingHero />
                </div>
            </section>

            <div className="lp-bento">
                <div className="lp-cell lp-cell-lead">
                    <BellRinging size={26} weight="duotone" />
                    <h2>Reminders that reach you</h2>
                    <p>
                        Push notifications sent on a schedule by the server, so they arrive with the
                        app closed and the phone locked. Not a timer that dies with the tab.
                    </p>
                </div>

                <div className="lp-cell">
                    <Sparkle size={22} weight="duotone" />
                    <h2>Never naggy</h2>
                    <p>Only when you are behind pace, only while you are awake, never after you finish.</p>
                </div>

                <div className="lp-cell">
                    <Fire size={22} weight="duotone" />
                    <h2>Streaks worth keeping</h2>
                    <p>XP for every glass, badges for the milestones, and a streak that only survives a real day.</p>
                </div>

                <div className="lp-cell lp-cell-wide">
                    <UsersThree size={22} weight="duotone" />
                    <h2>Bring someone with you</h2>
                    <p>Share a code to follow each other&apos;s day and send a nudge when they fall behind.</p>
                </div>
            </div>

            <p className="lp-note">
                Not medical advice. If a doctor has given you a fluid target, follow theirs.
            </p>
            </main>
        </>
    );
}
