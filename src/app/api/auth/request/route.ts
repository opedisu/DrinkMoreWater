import { NextResponse } from "next/server";
import { cleanupExpiredTokens, isValidEmail, issueLoginToken, normaliseEmail, rateLimit } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Behind a proxy, request.url is the address the container was reached on,
 * not the one the user typed. On Railway that is http://localhost:8080, and
 * every magic link built from it pointed at the user's own machine.
 *
 * APP_URL still wins when set. Otherwise the forwarded headers are the only
 * honest source for the public origin, and request.url is the last resort
 * rather than the first.
 */
function baseUrl(request: Request): string {
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, "");

    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (forwardedHost) {
        const proto = request.headers.get("x-forwarded-proto") ?? "https";
        return `${proto}://${forwardedHost}`;
    }

    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    // This failure is silent from the outside: the request succeeds and the
    // user receives a link to their own machine. Say so in the log.
    if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(origin)) {
        console.error(
            `Magic links are being built for ${origin}. Set APP_URL, or the proxy is not sending x-forwarded-host.`
        );
    }

    return origin;
}

export async function POST(request: Request): Promise<NextResponse> {
    let payload: { email?: string };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const email = normaliseEmail(payload.email ?? "");
    if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    // Five links per email per hour, and twenty per IP, is plenty for a
    // real person and useless for an abuser.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const withinLimits =
        (await rateLimit(`login:email:${email}`, 5, 3600)) && (await rateLimit(`login:ip:${ip}`, 20, 3600));
    if (!withinLimits) {
        return NextResponse.json({ error: "Too many sign-in attempts. Try again in an hour." }, { status: 429 });
    }

    const token = await issueLoginToken(email);
    const link = `${baseUrl(request)}/auth/verify?token=${encodeURIComponent(token)}`;
    const result = await sendMagicLink(email, link);
    await cleanupExpiredTokens();

    return NextResponse.json({ ok: true, devLink: result.devLink });
}
