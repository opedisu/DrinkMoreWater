import { NextResponse } from "next/server";
import { cleanupExpiredTokens, isValidEmail, issueLoginToken, normaliseEmail, rateLimit } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";

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
    const link = `${publicOrigin(request)}/auth/verify?token=${encodeURIComponent(token)}`;
    const result = await sendMagicLink(email, link);
    await cleanupExpiredTokens();

    return NextResponse.json({ ok: true, devLink: result.devLink });
}
