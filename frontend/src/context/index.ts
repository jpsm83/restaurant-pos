/**
 * **`src/context`** — React contexts that depend on **router location** and/or **session** and are
 * not the main auth store (`auth/store/AuthContext`).
 *
 * | Module | Role | Mounted | Consumers |
 * |--------|------|---------|-----------|
 * | **`SiteAudienceContext`** | Marketing “layer A” audience from URL (`customer` vs `business`). | **`PublicLayout`** only. | **`Navbar`** via `useOptionalSiteAudience` everywhere else; `useSiteAudience` under provider. |
 * | **`AuthModeContext`** | HttpOnly **`auth_mode`** cookie surfaced as React state + mutations. | **`App.tsx`** inside `BrowserRouter`. | **`RequireEmployeeAuthMode`**, **`SelectUserModePage`**, tests; re-exported from **`auth/index.ts`**. |
 *
 * Implementation details and flow diagrams live in each `*.tsx` file.
 */
export {
  SiteAudienceProvider,
  useOptionalSiteAudience,
  useSiteAudience,
  type SiteAudience,
} from "./SiteAudienceContext";
export { AuthModeProvider, useAuthMode, type AuthMode } from "./AuthModeContext";
