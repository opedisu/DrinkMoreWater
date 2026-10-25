"use client";

const EMOJI = ["💧", "💦", "🎉", "✨", "🌊"];
const COUNT = 28;

/**
 * Celebration burst. Positions are derived from the seed rather than
 * Math.random, so the component is pure and renders identically on the
 * server and the client. The parent mounts it and unmounts it again.
 */
export default function Confetti({ seed }: { seed: number }) {
    return (
        <div className="confetti" aria-hidden="true">
            {Array.from({ length: COUNT }, (_, index) => {
                const spread = (index * 37 + seed) % 100;
                const delay = ((index * 17 + seed) % 70) / 100;
                const duration = 1.9 + ((index * 23 + seed) % 110) / 100;

                return (
                    <span
                        key={index}
                        style={{
                            left: `${spread}%`,
                            animationDelay: `${delay}s`,
                            animationDuration: `${duration}s`
                        }}
                    >
                        {EMOJI[index % EMOJI.length]}
                    </span>
                );
            })}
        </div>
    );
}
