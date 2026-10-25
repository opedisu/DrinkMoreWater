import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { loadBuddies } from "@/lib/buddies";
import BuddiesScreen from "./BuddiesScreen";

export const dynamic = "force-dynamic";

export default async function BuddiesPage() {
    const user = await currentUser();
    if (!user) redirect("/login");

    return <BuddiesScreen buddyCode={user.buddy_code} initialBuddies={await loadBuddies(user.id)} />;
}
