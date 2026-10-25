import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { currentUser, randomCode } from "@/lib/session";
import { rateLimit } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Issues a new buddy code. The old one stops working immediately, so anyone
 * holding it can no longer follow you. Existing followers are kept -- remove
 * them individually if that is what you want.
 */
export async function POST(): Promise<NextResponse> {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    if (!(await rateLimit(`code:${user.id}`, 5, 3600))) {
        return NextResponse.json({ error: "Too many changes. Try again in an hour." }, { status: 429 });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const updated = await queryOne<{ buddy_code: string }>(
            `UPDATE users SET buddy_code = $2
             WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE buddy_code = $2)
             RETURNING buddy_code`,
            [user.id, randomCode()]
        );
        if (updated) return NextResponse.json({ ok: true, buddyCode: updated.buddy_code });
    }

    return NextResponse.json({ error: "Could not generate a new code. Try again." }, { status: 500 });
}
