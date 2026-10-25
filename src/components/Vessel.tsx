"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { tiltNeedsPermission, useTilt } from "@/lib/useTilt";

/**
 * The day's intake as a filling cylinder. Purely presentational: the readout
 * lives beside it rather than on top, because a panel floating over the
 * liquid hid the one line the vessel exists to show.
 */

const W = 104;
const H = 250;
const WALL = 3;
const AMP = 11;
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
    const svgRef = useRef<SVGSVGElement>(null);
    const requestTilt = useTilt(svgRef);

    async function enableTilt() {
        await requestTilt();
        // Hide the prompt either way: asking twice does not help, and iOS
        // will not re-prompt once the choice is made.
        setAsked(true);
    }

    // The server cannot know whether this browser gates the sensor, and
    // reading it during render produced a hydration mismatch. The server
    // snapshot is false, so the first client render agrees with the HTML.
    const askable = useSyncExternalStore(subscribeNever, tiltNeedsPermission, () => false);
    const [asked, setAsked] = useState(false);

    useEffect(() => {
        if (totalMl > previousTotal.current) setSplash((n) => n + 1);
        previousTotal.current = totalMl;
    }, [totalMl]);

    const showPrompt = askable && !asked;

    return (
        <div className="vessel-holder">
        <svg
            ref={svgRef}
            className="vessel"
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            // iOS only hands over the sensor after a gesture, so a tap on the
            // water asks for it. Everywhere else the listener is already on.
            onClick={showPrompt ? () => void enableTilt() : undefined}
            role={showPrompt ? "button" : undefined}
            aria-label={showPrompt ? "Tilt the water with your phone" : undefined}
            aria-hidden={showPrompt ? undefined : true}
        >
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
                <g className="vessel-tilt">
                    <g
                        className="vessel-liquid"
                        style={{ "--surface": `${surfaceY}px` } as React.CSSProperties}
                    >
                    <rect x={-W} y={AMP} width={W * 3} height={H} fill="url(#vesselFill)" />
                    <g className={`vessel-waves${splash > 0 ? " slosh" : ""}`} key={splash}>
                        <path className="wave wave-back" d={wave(W, AMP * 0.72)} />
                        <path className="wave wave-front" d={wave(W, AMP)} />
                        <path className="wave-crest" d={waveLine(W, AMP)} fill="none" />
                    </g>

                    {splash > 0 && (
                        <g className="splash" key={splash}>
                            <ellipse cx={W / 2} cy={AMP} rx={30} ry={7} />
                            <ellipse cx={W / 2} cy={AMP} rx={30} ry={7} />
                        </g>
                    )}
                    </g>
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

            {/* iOS only hands over the sensor after a gesture, and an
                invisible affordance is the same as none. */}
            {showPrompt && (
                <button className="tilt-prompt" onClick={() => void enableTilt()}>
                    Tap to tilt the water
                </button>
            )}
        </div>
    );
}

/**
 * Three identical periods spanning -W..2W. Scrolling by exactly one period
 * lands on an identical crest, so the loop has no seam. The `drift` keyframe
 * must translate by this same W.
 */
function wave(width: number, amp: number): string {
    return `${waveLine(width, amp)} L ${width * 2} ${amp * 2} L ${-width} ${amp * 2} Z`;
}

/** The surface curve on its own, open, so it can be stroked. */
function waveLine(width: number, amp: number): string {
    const period = `q ${width / 4} ${-amp} ${width / 2} 0 q ${width / 4} ${amp} ${width / 2} 0`;
    return `M ${-width} ${amp} ${period} ${period} ${period}`;
}

/** The answer never changes for the life of the page. */
function subscribeNever(): () => void {
    return () => {};
}
