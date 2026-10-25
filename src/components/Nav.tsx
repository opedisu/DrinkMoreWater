"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp, Drop, Gear, UsersThree, type Icon } from "@phosphor-icons/react";

const ITEMS: { href: string; Icon: Icon; label: string }[] = [
    { href: "/app", Icon: Drop, label: "Today" },
    { href: "/progress", Icon: ChartLineUp, label: "Progress" },
    { href: "/buddies", Icon: UsersThree, label: "Buddies" },
    { href: "/settings", Icon: Gear, label: "Settings" }
];

export default function Nav() {
    const pathname = usePathname();

    return (
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
                        <span className="nav-icon">
                            <Glyph size={22} weight={active ? "fill" : "regular"} />
                        </span>
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
