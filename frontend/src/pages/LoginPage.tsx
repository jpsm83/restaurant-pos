import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPostLoginDestination, login } from "@/auth";
import { useAuth } from "@/auth/store/AuthContext";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(() => {
    const shouldShowExpiredNotice =
      sessionStorage.getItem("auth_session_expired_notice") === "1";
    if (shouldShowExpiredNotice) {
      sessionStorage.removeItem("auth_session_expired_notice");
      return "Session expired. Please sign in again.";
    }
    return null;
  });

  const isSubmitting = state.status === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setSubmitError("Email and password are required.");
      return;
    }

    setSubmitError(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await login({
      email: email.trim(),
      password,
    });

    if (!result.ok || !result.data?.user) {
      dispatch({
        type: "AUTH_ERROR",
        payload: result.ok ? "Login failed." : result.error,
      });
      setSubmitError(result.ok ? "Login failed." : result.error);
      return;
    }

    localStorage.setItem("auth_had_session", "1");
    const sessionUser = result.data.user;
    dispatch({ type: "AUTH_SUCCESS", payload: sessionUser });
    navigate(getPostLoginDestination(sessionUser), { replace: true });
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use your account credentials to access the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {(submitError || state.error) && <Alert>{submitError || state.error}</Alert>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/signup">Create account</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
