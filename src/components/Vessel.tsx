"use client";

/**
 * The day's intake as a filling vessel rather than a progress ring. A ring
 * shows a fraction; a vessel shows a volume, which is what the user is
 * actually tracking. The surface carries two offset waves so a part-full
 * vessel reads as liquid even while still.
 */

const W = 190;
const H = 236;
const WALL = 3;
const AMP = 12;
const INNER = H - WALL * 2;

interface VesselProps {
    totalMl: number;
    goalMl: number;
    pacedTargetMl: number;
    primaryLabel: string;
    goalLabel: string;
}

export default function Vessel({ totalMl, goalMl, pacedTargetMl, primaryLabel, goalLabel }: VesselProps) {
    const fraction = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
    const percent = Math.round(fraction * 100);
    const done = totalMl >= goalMl;
    const behind = !done && totalMl < pacedTargetMl - 100;

    const status = done ? "done" : behind ? "behind" : "";
    const statusText = done ? "Goal reached" : behind ? `${percent}% · behind pace` : `${percent}% · on track`;

    /**
     * The wave's baseline sits AMP below the group origin, and its crests rise
     * AMP above that baseline. So the surface has to travel INNER + AMP, not
     * INNER: at 0% the crests must rest exactly on the clip's bottom edge
     * (nothing visible), and at 100% the baseline must reach the clip's top
     * (crests clipped, vessel genuinely full). Translating by INNER alone left
     * the vessel 12px short of full at the goal, which is the one moment it
     * has to look right.
     */
    const surfaceY = WALL + INNER - fraction * (INNER + AMP);

    return (
        <div className="vessel-wrap">
            <div className="vessel-stage">
                <svg className="vessel" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
                    <defs>
                        <clipPath id="vesselClip">
                            <rect x={WALL} y={WALL} width={W - WALL * 2} height={INNER} rx={54} />
                        </clipPath>
                        <linearGradient id="vesselFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--liquid-top)" />
                            <stop offset="100%" stopColor="var(--liquid-bottom)" />
                        </linearGradient>
                    </defs>

                    <rect
                        className="vessel-wall"
                        x={WALL / 2}
                        y={WALL / 2}
                        width={W - WALL}
                        height={H - WALL}
                        rx={56}
                        fill="none"
                        strokeWidth={WALL}
                    />

                    <g clipPath="url(#vesselClip)">
                        <g className="vessel-liquid" style={{ transform: `translateY(${surfaceY}px)` }}>
                            <rect x="0" y={AMP} width={W} height={H} fill="url(#vesselFill)" />
                            <path className="wave wave-back" d={wave(W, AMP)} />
                            <path className="wave wave-front" d={wave(W, AMP)} />
                        </g>
                    </g>

                    {/* Measure ticks, so the fill reads as a quantity not a mood. */}
                    {[0.25, 0.5, 0.75].map((t) => (
                        <line
                            key={t}
                            className="vessel-tick"
                            x1={W - 30}
                            x2={W - 16}
                            y1={WALL + INNER * (1 - t)}
                            y2={WALL + INNER * (1 - t)}
                        />
                    ))}
                </svg>

                <div className="vessel-readout">
                    <div className="vessel-value">{primaryLabel}</div>
                    <div className="vessel-goal">of {goalLabel}</div>
                </div>
            </div>

            <span className={`pill ${status}`}>{statusText}</span>
        </div>
    );
}

/**
 * Three identical periods spanning -W..2W. Scrolling the path by exactly one
 * period (W) lands on an identical crest, so the loop has no seam. The CSS
 * `drift` keyframe must translate by this same W.
 */
function wave(width: number, amp: number): string {
    const period = `q ${width / 4} ${-amp} ${width / 2} 0 q ${width / 4} ${amp} ${width / 2} 0`;
    return `M ${-width} ${amp} ${period} ${period} ${period} L ${width * 2} ${H} L ${-width} ${H} Z`;
}
