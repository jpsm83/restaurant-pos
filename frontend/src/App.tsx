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
import { BrowserRouter } from "react-router-dom";
import { AuthModeProvider } from "@/auth";
import { AppRoutes } from "@/appRoutes";

export { AppRoutes };

export default function App() {
  return (
    <BrowserRouter>
      <AuthModeProvider>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <AppRoutes />
        </div>
      </AuthModeProvider>
    </BrowserRouter>
  );
}
