import { useAuth } from "@/auth/store/AuthContext";

/** Customer home under `/:userId/customer` — chrome lives in `CustomerLayout`. */
export default function PostLoginPage() {
  const { state } = useAuth();

  return (
    <main className="flex min-h-0 flex-1 flex-col justify-center p-4">
      <section className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Logged in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Welcome, {state.user?.email ?? "user"}.
        </p>
      </section>
    </main>
  );
}
