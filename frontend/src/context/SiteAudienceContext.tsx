/**
 * **`src/context`** — see `context/index.ts` for how this folder fits together.
 *
 * ## `SiteAudienceContext` (this file)
 * **Marketing URL audience** (“customer” vs “business”) for **public** routes only. URL is the
 * source of truth (no `localStorage`).
 *
 * ## Wiring
 * - **`SiteAudienceProvider`** wraps **`PublicLayout`** (`layouts/PublicLayout.tsx`) so children
 *   under `path="/"` (index, `/login`, `/business`, …) can call **`useSiteAudience()`**.
 * - **`Navbar`** is shared on authenticated shells **without** this provider; it uses
 *   **`useOptionalSiteAudience()`** and defaults to **`customer`** when the context is missing
 *   (`Navbar.tsx`).
 * - Do **not** wrap tenant (`/business/:id`) or user (`/:userId/...`) shells — the pathname rules
 *   above would mis-classify paths like `/business/64a…` as `business` marketing.
 *
 * ## Rules (pathname → audience)
 * - `/business` or `/business/*` → `business` (includes `/business/register`).
 * - Otherwise → `customer`.
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

export type SiteAudience = "customer" | "business";

const SiteAudienceContext = createContext<SiteAudience | undefined>(undefined);

export function SiteAudienceProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const audience = useMemo((): SiteAudience => {
    if (pathname === "/business" || pathname.startsWith("/business/")) {
      return "business";
    }
    return "customer";
  }, [pathname]);

  return (
    <SiteAudienceContext.Provider value={audience}>
      {children}
    </SiteAudienceContext.Provider>
  );
}

export function useSiteAudience(): SiteAudience {
  const value = useContext(SiteAudienceContext);
  if (value === undefined) {
    throw new Error("useSiteAudience must be used within SiteAudienceProvider");
  }
  return value;
}

/** For shared chrome (`Navbar`) outside `PublicLayout`; marketing audience defaults to customer. */
export function useOptionalSiteAudience(): SiteAudience | null {
  return useContext(SiteAudienceContext) ?? null;
}
