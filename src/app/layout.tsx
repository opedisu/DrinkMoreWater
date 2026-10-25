import { ViewTransition } from "react";
import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Schibsted_Grotesk } from "next/font/google";
import PushRouter from "@/components/PushRouter";
import "./globals.css";

// Schibsted Grotesk was drawn for news interfaces, so its figures stay legible
// at the 10-12px label sizes this app leans on. Azeret Mono is a geometric mono
// built for data; it carries the numerals and stops the readout jittering as
// digits change width. Deliberately not Geist, which every Next.js app wears.
const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Azeret_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

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
    themeColor: "#03101c",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${sans.variable} ${mono.variable}`}>
            {/* Tabs are siblings, so they crossfade rather than slide. The nav
                carries its own stable name so it stays put across the change. */}
            <body>
                <PushRouter />
                <ViewTransition>{children}</ViewTransition>
            </body>
        </html>
    );
}
