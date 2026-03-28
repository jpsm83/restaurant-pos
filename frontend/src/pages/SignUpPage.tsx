import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { getPostLoginDestination, signup } from "@/auth";
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
import {
  isValidPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@packages/utils/passwordPolicy.ts";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isSubmitting = state.status === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage("Email, password and confirm password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Password and confirm password must match.");
      return;
    }

    if (!isValidPassword(password)) {
      setMessage(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setMessage(null);
    dispatch({ type: "AUTH_LOADING" });

    const result = await signup({
      email: email.trim(),
      password,
    });

    if (!result.ok || !result.data?.user) {
      const errorMessage = result.ok ? "Sign up failed." : result.error;
      dispatch({ type: "AUTH_ERROR", payload: errorMessage });
      setMessage(errorMessage);
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
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Create a customer account to access the app. Password: at least 8
            characters with uppercase, lowercase, a number, and a symbol.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">Confirm password</Label>
              <Input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
              />
            </div>

            {message && <Alert>{message}</Alert>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
