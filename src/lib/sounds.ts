"use client";

/**
 * The app's three sounds, synthesised rather than shipped.
 *
 * A handful of oscillators cost nothing to download, carry no licence, and
 * can be tuned in a line. Sample files would have meant binaries in the
 * repository and a provenance question for each one.
 *
 * They are quiet on purpose. A tracker you touch eight times a day should be
 * felt rather than heard, so these sit under a toast rather than over it, and
 * nothing plays for an error: the words already say it, and a beep every time
 * someone fumbles a form is how an app gets muted for good.
 */

const STORAGE_KEY = "dmw-sound";

/** Peak gain of the loudest sound. Deliberately low. */
const VOLUME = 0.09;

type Listener = () => void;
const listeners = new Set<Listener>();

let enabled: boolean | null = null;

function readPreference(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
        // Private mode, or storage blocked. Sound on is the default either way.
        return true;
    }
}

export function soundEnabled(): boolean {
    if (enabled === null) enabled = readPreference();
    return enabled;
}

export function setSoundEnabled(next: boolean): void {
    enabled = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
        // The setting simply will not survive a reload.
    }
    for (const listener of listeners) listener();
    if (next) play(drop);
}

export function subscribeSound(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Sound is a per-device choice, so the server cannot know it. */
export function soundEnabledOnServer(): boolean {
    return true;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

function audio(): AudioContext | null {
    if (typeof window === "undefined") return null;

    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;

    try {
        if (!context) context = new Ctor();
        // Browsers start the context suspended until a gesture. Every one of
        // these follows a tap, so by the time it matters this resolves.
        if (context.state === "suspended") void context.resume();
        return context;
    } catch {
        return null;
    }
}

interface Tone {
    /** Hertz at the start and end of the sweep. */
    from: number;
    to: number;
    /** Seconds from the start of the sound. */
    at: number;
    seconds: number;
    gain: number;
}

function play(tones: Tone[]): void {
    const c = audio();
    if (!c) return;

    for (const tone of tones) {
        const start = c.currentTime + tone.at;
        const osc = c.createOscillator();
        const envelope = c.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(tone.from, start);
        osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.seconds);

        // Ramps are exponential, which cannot reach or pass through zero, so
        // the envelope opens and closes on a value near silence instead.
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(tone.gain, start + 0.012);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + tone.seconds);

        osc.connect(envelope).connect(c.destination);
        osc.start(start);
        osc.stop(start + tone.seconds + 0.02);
    }
}

/**
 * A drip. The pitch rises because a real droplet's bubble shrinks as it
 * collapses; sweeping it downwards reads as a video-game blip instead.
 */
const drop: Tone[] = [{ from: 520, to: 1180, at: 0, seconds: 0.12, gain: VOLUME }];

/** Three rising notes, a fifth and an octave apart. Over in a fifth of a second. */
const fanfare: Tone[] = [
    { from: 587.33, to: 587.33, at: 0, seconds: 0.16, gain: VOLUME * 0.8 },
    { from: 783.99, to: 783.99, at: 0.085, seconds: 0.16, gain: VOLUME * 0.8 },
    { from: 1174.66, to: 1174.66, at: 0.17, seconds: 0.28, gain: VOLUME * 0.7 }
];

/** Something taken away: low, short, falling. */
const thud: Tone[] = [{ from: 240, to: 150, at: 0, seconds: 0.14, gain: VOLUME * 0.7 }];

export function playDrop(): void {
    if (soundEnabled()) play(drop);
}

export function playGoal(): void {
    if (soundEnabled()) play(fanfare);
}

export function playRemove(): void {
    if (soundEnabled()) play(thud);
}
