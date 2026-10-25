import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { loadBuddies, loadFollowers } from "@/lib/buddies";
import BuddiesScreen from "./BuddiesScreen";

export const dynamic = "force-dynamic";

export default async function BuddiesPage() {
    const user = await currentUser();
    if (!user) redirect("/login");

    const [buddies, followers] = await Promise.all([loadBuddies(user.id), loadFollowers(user.id)]);

    return (
        <BuddiesScreen
            buddyCode={user.buddy_code}
            initialBuddies={buddies}
            initialFollowers={followers}
        />
    );
}
