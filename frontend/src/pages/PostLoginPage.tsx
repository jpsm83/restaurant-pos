import { useAuth } from "@/auth/store/AuthContext";
import { logout, setAccessToken } from "@/auth";
import { Button } from "@/components/ui/button";

export default function PostLoginPage() {
  const { state, dispatch } = useAuth();

  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <section className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Logged in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Welcome, {state.user?.email ?? "user"}.
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          Post-login placeholder page (Phase 2.2 will refine routing behavior).
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={handleLogout}>
          Log out
        </Button>
      </section>
    </main>
  );
}
