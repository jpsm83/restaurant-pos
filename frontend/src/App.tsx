/**
 * App shell: router + auth mode (HttpOnly cookie) for employee routes.
 *
 * | Path | Layout / notes |
 * |------|----------------|
 * | `/` | `PublicLayout` — marketing index, login, signup, business |
 * | `/business/:businessId` | `BusinessSessionRouteShell` + `BusinessLayout` |
 * | `/:userId/mode` | `UserSessionRouteShell` — staff customer vs employee |
 * | `/:userId/customer` | `UserSessionRouteShell` + `CustomerLayout` |
 * | `/:userId/employee` | `UserSessionRouteShell` + `RequireEmployeeAuthMode` + `EmployeeLayout` |
 *
 * Route elements: **`appRoutes.tsx`** (`AppRoutes`). Guards: **`routes/AuthRouteGuards.tsx`**.
 */
import { AuthModeProvider } from "@/context/AuthModeContext";
import { AppRoutes } from "@/appRoutes";

export { AppRoutes };

export default function App() {
  return (
    <AuthModeProvider>
      <AppRoutes />
    </AuthModeProvider>
  );
}
