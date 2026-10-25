"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginForm() {
    const params = useSearchParams();
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
    const [error, setError] = useState(params.get("error") === "expired" ? "That link has expired. Here is a fresh one." : "");
    const [devLink, setDevLink] = useState<string | null>(null);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setStatus("sending");
        setError("");

        const response = await fetch("/api/auth/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string; devLink?: string };

        if (!response.ok) {
            setError(body.error ?? "Something went wrong. Try again.");
            setStatus("idle");
            return;
        }

        setDevLink(body.devLink ?? null);
        setStatus("sent");
    }

    return (
        <main className="hero">
            <div className="hero-drop">💧</div>
            <h1 style={{ fontSize: 28 }}>Sign in</h1>
            <p className="lede" style={{ fontSize: 15, marginBottom: 26 }}>
                No passwords. We email you a link that signs you straight in.
            </p>

            {status === "sent" ? (
                <div className="card" style={{ textAlign: "left" }}>
                    <div className="banner">
                        <span>📬</span>
                        <div>
                            Check <strong>{email}</strong> for your sign-in link. It works once and
                            expires in 20 minutes.
                        </div>
                    </div>
                    {devLink && (
                        <p className="muted" style={{ marginTop: 14, wordBreak: "break-all" }}>
                            Development mode — no email provider configured.{" "}
                            <a href={devLink}>Open the link directly</a>.
                        </p>
                    )}
                    <button
                        className="btn btn-ghost"
                        style={{ marginTop: 16 }}
                        onClick={() => setStatus("idle")}
                    >
                        Use a different email
                    </button>
                </div>
            ) : (
                <form className="card stack" style={{ textAlign: "left" }} onSubmit={submit}>
                    <div className="field">
                        <label htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            required
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

                    <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
                        {status === "sending" ? <span className="spinner" /> : "Email me a link"}
                    </button>
                </form>
            )}
        </main>
    );
}
