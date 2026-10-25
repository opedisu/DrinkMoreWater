"use client";

// Droplets rather than party emoji: the celebration should still look like
// the thing being celebrated.
const TONES = ["#4cc5f7", "#38bdf8", "#0ea5e9", "#7dd3fc", "#34d399"];
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
                const size = 6 + ((index * 13 + seed) % 7);

                return (
                    <span
                        key={index}
                        style={{
                            left: `${spread}%`,
                            width: `${size}px`,
                            height: `${size}px`,
                            background: TONES[index % TONES.length],
                            animationDelay: `${delay}s`,
                            animationDuration: `${duration}s`
                        }}
                    />
                );
            })}
        </div>
    );
}
