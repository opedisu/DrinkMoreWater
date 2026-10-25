import type { NextConfig } from "next";

const config: NextConfig = {
    poweredByHeader: false,
    // `pg` opens raw TCP/TLS sockets, so it must stay an external Node module
    // rather than being bundled.
    serverExternalPackages: ["pg"],
    async headers() {
        return [
            {
                // The service worker must never be cached, or reminder/push
                // logic can get stuck on an old version for weeks.
                source: "/sw.js",
                headers: [
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                    { key: "Service-Worker-Allowed", value: "/" }
                ]
            }
        ];
    }
};

export default config;
