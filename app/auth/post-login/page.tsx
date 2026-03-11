import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { options } from "@/app/api/auth/[...nextauth]/options";

/**
 * Post-login routing: after sign-in, redirect based on session type.
 * Business → /admin. User without employee → /. User with employee → /auth/choose-mode.
 */
export default async function PostLoginPage() {
  const session = await getServerSession(options);

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/auth/post-login");
  }

  const type = (session.user as { type?: string }).type;

  if (type === "business") {
    redirect("/admin");
  }

  if (type === "user") {
    const employeeId = (session.user as { employeeId?: string }).employeeId;
    if (employeeId) {
      redirect("/auth/choose-mode");
    }
    redirect("/");
  }

  redirect("/");
}
