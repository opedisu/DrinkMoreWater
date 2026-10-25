"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The day's intake as a filling cylinder. Purely presentational: the readout
 * lives beside it rather than on top, because a panel floating over the
 * liquid hid the one line the vessel exists to show.
 */

const W = 104;
const H = 250;
const WALL = 3;
const AMP = 9;
const INNER = H - WALL * 2;

export default function Vessel({ totalMl, goalMl }: { totalMl: number; goalMl: number }) {
    const fraction = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;

    /**
     * The wave baseline sits AMP below the group origin and its crests rise
     * AMP above that, so the surface travels INNER + AMP: at 0% the crests
     * rest on the clip's bottom edge, at 100% the baseline reaches its top.
     */
    const surfaceY = WALL + INNER - fraction * (INNER + AMP);

    // Water arriving should disturb the surface. Only on an increase, so undo
    // does not celebrate a removal.
    const [splash, setSplash] = useState(0);
    const previousTotal = useRef(totalMl);

    useEffect(() => {
        if (totalMl > previousTotal.current) setSplash((n) => n + 1);
        previousTotal.current = totalMl;
    }, [totalMl]);

    return (
        <svg className="vessel" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
            <defs>
                <clipPath id="vesselClip">
                    <rect x={WALL} y={WALL} width={W - WALL * 2} height={INNER} rx={26} />
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
                rx={28}
                fill="none"
                strokeWidth={WALL}
            />

            <g clipPath="url(#vesselClip)">
                <g className="vessel-liquid" style={{ transform: `translateY(${surfaceY}px)` }}>
                    <rect x="0" y={AMP} width={W} height={H} fill="url(#vesselFill)" />
                    <path className="wave wave-back" d={wave(W, AMP)} />
                    <path className="wave wave-front" d={wave(W, AMP)} />

                    {splash > 0 && (
                        <g className="splash" key={splash}>
                            <ellipse cx={W / 2} cy={AMP} rx={30} ry={7} />
                            <ellipse cx={W / 2} cy={AMP} rx={30} ry={7} />
                        </g>
                    )}
                </g>
            </g>

            {/* Quarter marks, so the fill reads as a quantity not a mood. */}
            {[0.25, 0.5, 0.75].map((t) => (
                <line
                    key={t}
                    className="vessel-tick"
                    x1={WALL + 9}
                    x2={WALL + 20}
                    y1={WALL + INNER * (1 - t)}
                    y2={WALL + INNER * (1 - t)}
                />
            ))}
        </svg>
    );
}

/**
 * Three identical periods spanning -W..2W. Scrolling by exactly one period
 * lands on an identical crest, so the loop has no seam. The `drift` keyframe
 * must translate by this same W.
 */
function wave(width: number, amp: number): string {
    const period = `q ${width / 4} ${-amp} ${width / 2} 0 q ${width / 4} ${amp} ${width / 2} 0`;
    return `M ${-width} ${amp} ${period} ${period} ${period} L ${width * 2} ${H} L ${-width} ${H} Z`;
}
