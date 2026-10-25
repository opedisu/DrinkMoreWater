import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { loadFollowers, removeFollower } from "@/lib/buddies";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    return NextResponse.json({ followers: await loadFollowers(user.id) });
}

/** Removes someone who follows you, and stops them following you again. */
export async function DELETE(request: Request): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const followerId = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^\d+$/.test(followerId)) {
        return NextResponse.json({ error: "Missing follower id." }, { status: 400 });
    }

    await removeFollower(user.id, followerId);
    return NextResponse.json({ ok: true });
}
