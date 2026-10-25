import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import Onboarding from "./Onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.weight_kg !== null) redirect("/app");

    return <Onboarding initialName={user.name} />;
}
