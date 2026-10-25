"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Drop, Warning } from "@phosphor-icons/react";

export type ToastKind = "info" | "success" | "error";

export interface ToastState {
    message: string;
    kind: ToastKind;
}

export function useToast() {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((message: string, kind: ToastKind = "info") => {
        if (timer.current) clearTimeout(timer.current);
        setToast({ message, kind });
        timer.current = setTimeout(() => setToast(null), 3200);
    }, []);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    return { toast, show };
}

export function Toast({ toast }: { toast: ToastState | null }) {
    if (!toast) return null;
    const Glyph = toast.kind === "success" ? CheckCircle : toast.kind === "error" ? Warning : Drop;
    const tone =
        toast.kind === "success" ? "var(--success)" : toast.kind === "error" ? "var(--danger)" : "var(--accent)";

    return (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
            <Glyph size={18} weight="fill" color={tone} style={{ flex: "0 0 auto" }} />
            <span>{toast.message}</span>
        </div>
    );
}
