/* Marketing URL audience — public routes only (see `PublicLayout`). */
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

/**
 * Marketing audience (layer A) — **URL is the source of truth**; no `localStorage` (strategy §6.1).
 *
 * Rules:
 * - Path is exactly `/business` **or** starts with `/business/` → **`business`** (covers `/business/register`).
 * - Everything else under this provider → **`customer`** (`/`, `/login`, `/signup`, etc.).
 *
 * Use **only** under public (unauthenticated marketing/auth) routes — not under `/:userId/*` or `/business/:businessId` shells.
 */
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
