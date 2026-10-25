"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
    { href: "/app", icon: "💧", label: "Today" },
    { href: "/progress", icon: "📈", label: "Progress" },
    { href: "/buddies", icon: "💞", label: "Buddies" },
    { href: "/settings", icon: "⚙️", label: "Settings" }
];

export default function Nav() {
    const pathname = usePathname();

    return (
        <nav className="nav">
            {ITEMS.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${pathname === item.href ? " active" : ""}`}
                >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
