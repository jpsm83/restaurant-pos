/**
 * **`src/context`** — shared UI/session context layer.
 *
 * ## `SiteAudienceContext` (this file)
 * **Marketing URL audience** (“customer” vs “business”) for **public** chrome and copy only.
 * URL is the source of truth (no `localStorage`). It is not auth state: `/login` and `/signup`
 * stay shared for both audiences.
 *
 * ## Wiring
 * - **`SiteAudienceProvider`** wraps **`PublicLayout`** (`layouts/PublicLayout.tsx`) so children
 *   under `path="/"` (index, `/login`, `/business`, …) can call **`useSiteAudience()`**.
 * - **`Navbar`** uses the pathname directly for its marketing switch; the audience never
 *   changes the shared `/login` and `/signup` destinations.
 * - Do **not** wrap tenant (`/business/:id`) or self-service (`/dashboard`, `/employee`, …) shells —
 *   the pathname rules above would mis-classify paths like `/business/64a…` as `business` marketing.
 *
 * ## Rules (pathname → audience)
 * - `/business` or `/business/*` → `business`.
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
