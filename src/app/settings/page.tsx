import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { buildSnapshot } from "@/lib/snapshot";
import SettingsScreen from "./SettingsScreen";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const user = await currentUser();
    if (!user) redirect("/login");

    return (
        <SettingsScreen
            initial={await buildSnapshot(user)}
            vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
    );
}
