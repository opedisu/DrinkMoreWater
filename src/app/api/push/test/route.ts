import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { sendToUser } from "@/lib/push";
import { rateLimit } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    if (!(await rateLimit(`pushtest:${user.id}`, 10, 600))) {
        return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
    }

    const sent = await sendToUser(user.id, {
        title: "Reminders are working 💧",
        body: "This is exactly what a nudge will look like.",
        tag: "dmw-test",
        url: "/app",
        quickAddMl: 250
    });

    if (sent === 0) {
        return NextResponse.json(
            { error: "No device is registered for reminders yet, or the keys are not configured." },
            { status: 400 }
        );
    }
    return NextResponse.json({ ok: true, sent });
}
