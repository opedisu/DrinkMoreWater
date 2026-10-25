import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { buildSnapshot } from "@/lib/snapshot";
import ProgressScreen from "./ProgressScreen";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
    const user = await currentUser();
    if (!user) redirect("/login");

    return <ProgressScreen initial={await buildSnapshot(user)} />;
}
