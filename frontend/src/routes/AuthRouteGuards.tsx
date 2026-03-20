import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100">
        <p className="text-sm text-neutral-600">Loading session...</p>
      </main>
    );
  }

  if (state.status !== "authenticated" || !state.user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (state.status === "loading" || state.status === "idle") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100">
        <p className="text-sm text-neutral-600">Loading session...</p>
      </main>
    );
  }

  if (state.status === "authenticated" && state.user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
