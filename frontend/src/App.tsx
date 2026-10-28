/**
 * App shell: router + auth mode (HttpOnly cookie) for employee routes.
 *
 * | Path | Layout / notes |
 * |------|----------------|
 * | `/` | `PublicLayout` — marketing index, login, signup, business |
 * | `/business/:businessId` | `BusinessRouteShell` + `BusinessLayout` |
 * | `/:userId/mode` | `UserSessionRouteShell` — staff customer vs employee |
 * | `/:userId/customer` | `UserSessionRouteShell` + `CustomerLayout` |
 * | `/:userId/employee` | `UserSessionRouteShell` + `RequireEmployeeAuthMode` + `EmployeeLayout` |
 *
 * Route elements: **`appRoutes.tsx`** (`AppRoutes`). Guards: **`routes/AuthRouteGuards.tsx`**.
 */
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthModeProvider } from "@/context/AuthModeContext";
import { AppRoutes } from "@/appRoutes";
import { getGoogleClientId } from "@/auth/google";

export { AppRoutes };

export default function App() {
  const clientId = getGoogleClientId();
  const app = (
    <AuthModeProvider>
      <AppRoutes />
    </AuthModeProvider>
  );

  return clientId ? (
    <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  );
}
