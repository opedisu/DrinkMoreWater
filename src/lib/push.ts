import webpush, { type PushSubscription } from "web-push";
import { query } from "./db";

let configured = false;

function configure(): boolean {
    if (configured) return true;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@drinkmorewater.app";
    if (!publicKey || !privateKey) {
        console.error("VAPID keys missing -- run `npm run vapid` and set them in the environment.");
        return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
}

export interface PushPayload {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    /** Rendered as notification action buttons; handled in the service worker. */
    quickAddMl?: number;
}

interface SubscriptionRow {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

/** Sends to every device a user has registered. Dead endpoints are pruned. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!configure()) return 0;

    const subs = await query<SubscriptionRow>(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
        [userId]
    );
    if (subs.length === 0) return 0;

    const body = JSON.stringify(payload);
    let sent = 0;
    const dead: string[] = [];

    await Promise.all(
        subs.map(async (sub) => {
            const subscription: PushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            try {
                await webpush.sendNotification(subscription, body, { TTL: 1800, urgency: "normal" });
                sent += 1;
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                // 404/410 mean the browser threw the subscription away.
                if (status === 404 || status === 410) {
                    dead.push(sub.id);
                } else {
                    console.error(`push failed for subscription ${sub.id}:`, status ?? error);
                }
            }
        })
    );

    if (dead.length > 0) {
        await query("DELETE FROM push_subscriptions WHERE id = ANY($1::bigint[])", [dead]);
    }
    return sent;
}
