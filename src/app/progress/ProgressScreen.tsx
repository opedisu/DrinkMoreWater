"use client";

import { useEffect, useState } from "react";
import {
    CalendarCheck,
    Crown,
    Diamond,
    Drop,
    Fire,
    Lightning,
    Medal,
    Star,
    SunHorizon,
    Target,
    Trophy,
    UsersThree,
    type Icon
} from "@phosphor-icons/react";

import Nav from "@/components/Nav";
import type { Snapshot } from "@/lib/snapshot";
import { formatAmount } from "@/lib/goal";
import { BADGES } from "@/lib/progression";
import type { DayTotal, Unit } from "@/lib/types";

// Badge art lives here rather than in lib/progression: the award is data,
// the glyph is presentation.
const BADGE_ICON: Record<string, Icon> = {
    first_sip: Drop,
    first_goal: Target,
    streak_3: Fire,
    streak_7: CalendarCheck,
    streak_30: Trophy,
    streak_100: Diamond,
    early_bird: SunHorizon,
    night_finisher: Lightning,
    logs_50: Medal,
    logs_250: Crown,
    buddy_up: UsersThree
};

interface StatsResponse {
    days: number;
    goalMl: number;
    unit: Unit;
    series: DayTotal[];
    summary: { averageMl: number; goalsMet: number; goalRate: number; bestDayMl: number };
}

const RANGES = [7, 14, 30];

export default function ProgressScreen({ initial }: { initial: Snapshot }) {
    const [days, setDays] = useState(14);
    const [stats, setStats] = useState<StatsResponse | null>(null);

    // The chart range is chosen by the user, so it is fetched on demand.
    useEffect(() => {
        let cancelled = false;
        void fetch(`/api/stats?days=${days}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => {
                if (!cancelled) setStats(body);
            });
        return () => {
            cancelled = true;
        };
    }, [days]);

    const unit = initial.user.unit;
    const earned = new Set(initial.rewards.badges.map((badge) => badge.code));
    const peak = stats ? Math.max(stats.goalMl, ...stats.series.map((day) => day.total_ml)) : 1;

    return (
        <>
            <main className="shell">
                <header className="topbar">
                    <div className="greeting">
                        Your history
                        <strong>Progress</strong>
                    </div>
                    <div className="seg" style={{ width: "auto" }}>
                        {RANGES.map((range) => (
                            <button
                                key={range}
                                className={days === range ? "active" : ""}
                                onClick={() => setDays(range)}
                            >
                                {range}d
                            </button>
                        ))}
                    </div>
                </header>

                <section className="section">
                    <div className="card-title">Last {days} days</div>
                    {stats ? (
                        <>
                            <div className="bars">
                                {stats.series.map((day) => (
                                    <div className="bar-col" key={day.local_date} title={`${day.local_date}: ${formatAmount(day.total_ml, unit)}`}>
                                        <div
                                            className={`bar${day.total_ml >= stats.goalMl ? " met" : ""}`}
                                            style={{ height: `${Math.max(2, (day.total_ml / peak) * 100)}%` }}
                                        />
                                        {days <= 14 && (
                                            <span className="bar-label">{day.local_date.slice(8)}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="grid-3" style={{ marginTop: 18 }}>
                                <div className="stat">
                                    <div className="stat-value">{stats.summary.goalRate}%</div>
                                    <div className="stat-label">Goals met</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-value">{formatAmount(stats.summary.averageMl, unit)}</div>
                                    <div className="stat-label">Daily avg</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-value">{formatAmount(stats.summary.bestDayMl, unit)}</div>
                                    <div className="stat-label">Best day</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <span className="spinner" />
                    )}
                </section>

                <section className="section">
                    <div className="card-title">Streaks</div>
                    <div className="grid-3">
                        <div className="stat">
                            <div className="stat-value stat-ico">
                                <Fire size={17} weight="fill" />
                                {initial.rewards.streakCurrent}
                            </div>
                            <div className="stat-label">Current</div>
                        </div>
                        <div className="stat">
                            <div className="stat-value stat-ico">
                                <Trophy size={17} weight="fill" />
                                {initial.rewards.streakBest}
                            </div>
                            <div className="stat-label">Best ever</div>
                        </div>
                        <div className="stat">
                            <div className="stat-value stat-ico">
                                <Star size={17} weight="fill" />
                                {initial.rewards.level}
                            </div>
                            <div className="stat-label">{initial.rewards.levelTitle}</div>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="card-title">
                        Badges · {earned.size} of {BADGES.length}
                    </div>
                    <div className="badge-grid">
                        {BADGES.map((badge) => (
                            <div
                                key={badge.code}
                                className={`badge${earned.has(badge.code) ? "" : " locked"}`}
                                title={badge.description}
                            >
                                <div className="badge-icon">
                                    {(() => {
                                        const Glyph = BADGE_ICON[badge.code] ?? Medal;
                                        return <Glyph size={24} weight={earned.has(badge.code) ? "fill" : "regular"} />;
                                    })()}
                                </div>
                                <div className="badge-name">{badge.name}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
            <Nav />
        </>
    );
}
