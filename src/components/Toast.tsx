"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    const icon = toast.kind === "success" ? "✅" : toast.kind === "error" ? "⚠️" : "💧";
    return (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
            <span>{icon}</span>
            <span>{toast.message}</span>
        </div>
    );
}
