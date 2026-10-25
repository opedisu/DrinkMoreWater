/**
 * The public origin of this deployment.
 *
 * Behind a proxy, request.url is the address the container was reached on,
 * not the one the user typed. On Railway that is http://localhost:8080, so
 * anything built from it (a magic link, a redirect after sign-in) sends the
 * user to their own machine.
 *
 * This lives in one place because the same mistake was made twice: once
 * building the link, once redirecting after it was followed.
 */
export function publicOrigin(request: Request): string {
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, "");

    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (forwardedHost) {
        const proto = request.headers.get("x-forwarded-proto") ?? "https";
        return `${proto}://${forwardedHost}`;
    }

    const origin = new URL(request.url).origin;

    // Invisible from outside: the request succeeds and the user is sent
    // somewhere unreachable. Say so in the log.
    if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(origin)) {
        console.error(
            `Public origin resolved to ${origin}. Set APP_URL, or the proxy is not sending x-forwarded-host.`
        );
    }

    return origin;
}
