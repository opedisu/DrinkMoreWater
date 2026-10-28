/* DrinkMoreWater service worker: shows reminders and handles the quick-add
   action button so a glass can be logged straight from the notification. */

const VERSION = "dmw-v1";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = { title: "Time for water 💧", body: "Tap to log a glass." };
    }

    const title = payload.title || "Time for water 💧";
    const quickAddMl = payload.quickAddMl || 250;

    const options = {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: payload.tag || "dmw-reminder",
        renotify: true,
        data: { url: payload.url || "/app", quickAddMl },
        actions: [
            { action: "log", title: `Log ${quickAddMl} ml` },
            { action: "later", title: "Not now" }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "later") return;

    const data = event.notification.data || {};

    if (event.action === "log") {
        event.waitUntil(logFromNotification(data.quickAddMl || 250));
        return;
    }

    event.waitUntil(openApp(data.url || "/app"));
});

async function logFromNotification(amountMl) {
    try {
        const response = await fetch("/api/intake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ amountMl, drink: "water" })
        });

        if (!response.ok) throw new Error(`status ${response.status}`);
        const result = await response.json();

        // Tell any open tab to refresh its numbers.
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
            client.postMessage({ type: "intake-logged", totalMl: result.totalMl });
        }

        await self.registration.showNotification(
            result.justHitGoal ? "Goal reached 🎉" : `Logged ${amountMl} ml 💧`,
            {
                body: result.justHitGoal
                    ? result.streakRepaired
                        ? "That is your goal, and one missed day forgiven."
                        : "That is your goal for today. Lovely."
                    : `${Math.max(0, result.goalMl - result.totalMl)} ml to go.`,
                icon: "/icons/icon-192.png",
                badge: "/icons/badge-96.png",
                tag: "dmw-logged"
            }
        );
    } catch (error) {
        // Most likely the session cookie expired; send them to the app instead.
        await self.registration.showNotification("Could not log that", {
            body: "Open the app to log it and check you are still signed in.",
            icon: "/icons/icon-192.png",
            tag: "dmw-log-failed",
            data: { url: "/app" }
        });
    }
}

const PENDING_NAV = "dmw-pending-nav";

/**
 * Records where a tapped notification wants to go, somewhere the page can
 * read once it wakes up.
 *
 * postMessage is not enough on its own: an installed PWA on iOS is frozen
 * while backgrounded, so the message can arrive at a page that is not
 * listening and is simply lost. The Cache API is reachable from both sides
 * and survives the freeze.
 */
async function recordPendingNav(url) {
    try {
        const cache = await caches.open(PENDING_NAV);
        await cache.put("/pending", new Response(JSON.stringify({ url, at: Date.now() })));
    } catch {
        // Storage unavailable. The other paths still apply.
    }
}

/**
 * Opens the app at the notification's destination.
 *
 * Three routes, because no single one works everywhere. navigate() is
 * absent on iOS. postMessage misses a frozen page. The cache note is read
 * by the page when it becomes visible, which is the case those two miss.
 */
async function openApp(url) {
    const target = new URL(url, self.location.origin).href;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clients) {
        if (!("focus" in client)) continue;
        if (client.url === target) return client.focus();

        await recordPendingNav(url);

        if ("navigate" in client) {
            try {
                const navigated = await client.navigate(target);
                return (navigated || client).focus();
            } catch {
                // Falls through.
            }
        }

        client.postMessage({ type: "navigate", url });
        return client.focus();
    }

    return self.clients.openWindow(target);
}
