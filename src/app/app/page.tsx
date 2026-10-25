import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { buildSnapshot } from "@/lib/snapshot";
import { parseAmountMl, recordIntake } from "@/lib/intake";
import TodayScreen from "./TodayScreen";

export const dynamic = "force-dynamic";

export default async function AppPage({
    searchParams
}: {
    searchParams: Promise<{ add?: string }>;
}) {
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.weight_kg === null) redirect("/onboarding");

    // Home-screen shortcuts and the notification action land on /app?add=250.
    // Logging it here means the drink is recorded before the page even paints,
    // and the redirect clears the parameter so a refresh cannot double-count.
    const { add } = await searchParams;
    if (add !== undefined) {
        const amountMl = parseAmountMl(add);
        if (amountMl !== null) await recordIntake(user, amountMl, "water");
        redirect("/app");
    }

    return (
        <TodayScreen
            initial={await buildSnapshot(user)}
            vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
    );
}
