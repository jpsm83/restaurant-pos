import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { options } from "@/app/api/auth/[...nextauth]/options";
import Link from "next/link";

/**
 * Mode selection for users who are also employees: continue as customer or as employee.
 * Employee option is enabled only when canLogAsEmployee (scheduled, 5 min before shift).
 */
export default async function ChooseModePage() {
  const session = await getServerSession(options);

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/auth/post-login");
  }

  const type = (session.user as { type?: string }).type;
  const employeeId = (session.user as { employeeId?: string }).employeeId;
  const canLogAsEmployee = (session.user as { canLogAsEmployee?: boolean }).canLogAsEmployee;

  if (type !== "user" || !employeeId) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-2xl font-bold">How do you want to continue?</h1>
      <p className="mb-6 text-gray-600">{session.user.email}</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <form action="/api/auth/set-mode" method="POST">
          <input type="hidden" name="mode" value="customer" />
          <button
            type="submit"
            className="rounded bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
          >
            Continue as customer
          </button>
        </form>
        {canLogAsEmployee ? (
          <form action="/api/auth/set-mode" method="POST">
            <input type="hidden" name="mode" value="employee" />
            <button
              type="submit"
              className="rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
            >
              Continue as employee
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded bg-gray-300 px-6 py-3 font-medium text-gray-500"
            >
              Continue as employee
            </button>
            <span className="text-sm text-gray-500">
              Available from 5 minutes before your shift
            </span>
          </div>
        )}
      </div>
      <Link href="/" className="mt-8 text-sm text-blue-600 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
