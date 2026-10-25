"use client";

import { useEffect, useRef, useState } from "react";
import { BeerBottle, Coffee, Jar, PintGlass } from "@phosphor-icons/react";

const TARGET_ML = 2100;
const COUNT_MS = 1400;

/**
 * The hero demonstrates the app rather than describing it: the readout
 * counts up on arrival, the way it does when you log a drink, while the
 * page itself fills behind it. The controls are the real components, not a
 * drawing of them. There is no vessel here on purpose: the page is the
 * glass, and a glass inside a glass says the same thing twice.
 */
export default function LandingHero() {
    const [ml, setMl] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

        // Reduced motion takes the same path with one step, rather than a
        // synchronous setState that would cascade a render.
        const steps = reduce ? 1 : 28;
        let step = 0;
        timer.current = setInterval(() => {
            step += 1;
            // Ease out, so it arrives rather than stops.
            const t = 1 - Math.pow(1 - step / steps, 3);
            setMl(Math.round(TARGET_ML * t));
            if (step >= steps && timer.current) clearInterval(timer.current);
        }, reduce ? 0 : COUNT_MS / steps);

        return () => {
            if (timer.current) clearInterval(timer.current);
        };
    }, []);

    const litres = (ml / 1000).toFixed(1);

    return (
        <div className="lp-stage">
            <div className="lp-readout">
                <span className="lp-total">{litres} L</span>
                <span className="lp-goal">of 3 L today</span>
            </div>

            {/* The real controls, so the page shows the product working. */}
            <div className="lp-chips" aria-hidden="true">
                {[
                    { Glyph: Coffee, label: "150 ml" },
                    { Glyph: PintGlass, label: "250 ml" },
                    { Glyph: BeerBottle, label: "500 ml" },
                    { Glyph: Jar, label: "750 ml" }
                ].map(({ Glyph, label }) => (
                    <span className="lp-chip" key={label}>
                        <Glyph size={20} weight="duotone" />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}
