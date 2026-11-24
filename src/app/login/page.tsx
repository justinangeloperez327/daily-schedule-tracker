import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

type Props = { searchParams: Promise<{ next?: string }> };

// Only allow same-site relative redirects after sign-in.
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/schedules";
}

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if (await getCurrentUser().catch(() => null)) redirect(destination);
  return <LoginForm next={destination} />;
}
