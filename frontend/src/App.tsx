/**
 * App shell: router + session-backed Customer | Business mode on user routes.
 *
 * | Path | Layout / notes |
 * |------|----------------|
 * | `/` | `PublicLayout` — marketing index, login, signup, business |
 * | `/business/:businessId` | `BusinessRouteShell` + `BusinessLayout` |
 * | `/mode` | `ProtectedRoute` — Customer | Business mode selection |
 * | `/dashboard`, `/favorites` | `ProtectedRoute` + `CustomerLayout` |
 * | `/account`, `/account/profile`, `/account/address` | `ProtectedRoute` + `CustomerAccountLayout` |
 * | `/profile` | legacy redirect to `/account/profile` |
 * | `/employee/*` | `ProtectedRoute` + compatibility redirects (no employee shell) |
 * | `/:userId/...` | valid ObjectId ids redirect; unknown shapes render 404 (ADR-0013) |
 *
 * Route elements: **`appRoutes.tsx`** (`AppRoutes`). Guards: **`routes/AuthRouteGuards.tsx`**.
 */
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthModeProvider } from "@/context/AuthModeContext";
import { AppRoutes } from "@/appRoutes";
import {
  getGoogleClientId,
  installGoogleInitializeGuard,
} from "@/auth/google";

export { AppRoutes };

export default function App() {
  const clientId = getGoogleClientId();
  const app = (
    <AuthModeProvider>
      <AppRoutes />
    </AuthModeProvider>
  );

  return clientId ? (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadSuccess={installGoogleInitializeGuard}
    >
      {app}
    </GoogleOAuthProvider>
  ) : (
    app
  );
}
