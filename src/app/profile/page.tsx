import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/profile");
  return <ProfileForm user={user} />;
}
