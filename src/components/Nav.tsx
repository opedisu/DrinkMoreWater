"use client";

import { ViewTransition } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp, Drop, Gear, UsersThree, type Icon } from "@phosphor-icons/react";

const ITEMS: { href: string; Icon: Icon; label: string }[] = [
    { href: "/app", Icon: Drop, label: "Today" },
    { href: "/progress", Icon: ChartLineUp, label: "Progress" },
    { href: "/buddies", Icon: UsersThree, label: "Buddies" },
    { href: "/settings", Icon: Gear, label: "Settings" }
];

/**
 * Lives inside the Link because useLinkStatus reads the pending state of its
 * nearest Link ancestor.
 *
 * These routes are server rendered from the database, so a tap used to do
 * nothing visible until the new page arrived and people tapped again. The
 * pending state answers the tap immediately.
 */
function NavBody({ Glyph, label, active }: { Glyph: Icon; label: string; active: boolean }) {
    const { pending } = useLinkStatus();
    return (
        <span className={`nav-body${pending ? " pending" : ""}`}>
            <span className="nav-icon">
                <Glyph size={22} weight={active || pending ? "fill" : "regular"} />
            </span>
            {label}
        </span>
    );
}

export default function Nav() {
    const pathname = usePathname();

    return (
        <ViewTransition name="nav">
            <nav className="nav" aria-label="Primary">
                {ITEMS.map(({ href, Icon: Glyph, label }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`nav-item${active ? " active" : ""}`}
                            aria-current={active ? "page" : undefined}
                        >
                            <NavBody Glyph={Glyph} label={label} active={active} />
                        </Link>
                    );
                })}
            </nav>
        </ViewTransition>
    );
}
