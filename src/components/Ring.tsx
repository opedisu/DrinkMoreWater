"use client";

const SIZE = 208;
const STROKE = 15;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RingProps {
    totalMl: number;
    goalMl: number;
    pacedTargetMl: number;
    primaryLabel: string;
    goalLabel: string;
}

export default function Ring({ totalMl, goalMl, pacedTargetMl, primaryLabel, goalLabel }: RingProps) {
    const fraction = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
    const percent = Math.round(fraction * 100);
    const done = totalMl >= goalMl;
    const behind = !done && totalMl < pacedTargetMl - 100;

    const statusClass = done ? "done" : behind ? "behind" : "";
    const statusText = done
        ? "Goal reached 🎉"
        : behind
          ? `${percent}% — a little behind`
          : `${percent}% — on track`;

    return (
        <div className="ring-wrap">
            <svg className="ring" width={SIZE} height={SIZE} aria-hidden="true">
                <defs>
                    <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor={done ? "#34d399" : "#0ea5e9"} />
                    </linearGradient>
                </defs>
                <circle
                    className="ring-track"
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={STROKE}
                />
                <circle
                    className="ring-fill"
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={STROKE}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                />
            </svg>
            <div className="ring-label">
                <div className="ring-value">{primaryLabel}</div>
                <div className="ring-goal">of {goalLabel}</div>
                <div className={`ring-pct ${statusClass}`}>{statusText}</div>
            </div>
        </div>
    );
}
