import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "DrinkMoreWater",
    description: "Hit your water goal every day. Gentle reminders, honest tracking, streaks worth keeping.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        title: "Water",
        statusBarStyle: "black-translucent"
    },
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }]
    }
};

export const viewport: Viewport = {
    themeColor: "#082f49",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
