import { NextResponse } from "next/server";
import { consumeLoginToken, findOrCreateUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { isValidTimezone } from "@/lib/time";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const origin = publicOrigin(request);
    const token = url.searchParams.get("token") ?? "";
    const timezone = url.searchParams.get("tz") ?? "";

    const email = await consumeLoginToken(token);
    if (!email) {
        return NextResponse.redirect(new URL("/login?error=expired", origin));
    }

    const user = await findOrCreateUser(email, isValidTimezone(timezone) ? timezone : "UTC");
    await setSessionCookie(user.id);

    const destination = user.weight_kg === null ? "/onboarding" : "/app";
    return NextResponse.redirect(new URL(destination, origin));
}
