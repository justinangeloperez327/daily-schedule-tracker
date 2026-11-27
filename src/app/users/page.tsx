import { redirect } from "next/navigation";
import { UserManager } from "@/components/user-manager";
import { getCurrentUser } from "@/lib/auth";

export default async function UsersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/users");
  if (user.role !== "admin") redirect("/dashboard");
  return <UserManager currentUserId={user.id} />;
}
