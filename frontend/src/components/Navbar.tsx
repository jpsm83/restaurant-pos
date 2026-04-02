import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

/**
 * App-wide top bar. Public routes: audience switch + auth CTAs (`SiteAudienceProvider`).
 * Authenticated shells: account popover with actor-specific links.
 */
export default function Navbar() {
  const { t } = useTranslation("nav");
  const { state } = useAuth();
  const { pathname } = useLocation();
  const { state: sidebarState } = useSidebar();
  const isAuthenticated =
    state.status === "authenticated" && Boolean(state.user);
  const isLoading = state.status === "loading" || state.status === "idle";

  // Marketing audience (only impacts login/signup links). We intentionally treat
  // `/business/:businessId/*` as an authenticated tenant shell, not marketing.
  const audience =
    pathname === "/business" ||
    pathname === "/business/register" ||
    pathname === "/business/signup"
      ? "business"
      : "customer";

  const showSidebarTrigger =
    isAuthenticated &&
    (pathname.startsWith("/business/") ||
      /\/customer(\/|$)/.test(pathname) ||
      /\/employee(\/|$)/.test(pathname));

  const sidebarToggleAriaLabel =
    sidebarState === "expanded" ? t("sidebar.closeMenu") : t("sidebar.openMenu");

  const loginHref = `/login?audience=${audience}`;
  const signUpHref =
    audience === "business"
      ? "/business/register"
      : "/signup?audience=customer";

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 h-12 shrink-0 border-b border-neutral-200 bg-white"
      aria-label={t("mainNav.ariaLabel")}
    >
      <div className="flex h-full w-full items-center justify-between gap-3 px-6 sm:px-8">
        <div className="flex items-center gap-3">
          {showSidebarTrigger ? (
            <div className="shrink-0 md:hidden">
              <SidebarTrigger aria-label={sidebarToggleAriaLabel} />
            </div>
          ) : null}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/imperium.png"
              alt={t("brand.logoAlt")}
              className="h-8 w-10 object-contain"
              width={32}
              height={32}
            />
            <span className="text-md font-semibold text-neutral-800">
              {t("brand.title")}
            </span>
          </Link>
        </div>

        <div className="flex items-center  gap-4 text-sm">
          {!isLoading && !isAuthenticated && audience === "customer" ? (
            <Button
              variant="ghost"
              className="h-auto px-2 py-1 text-red-500 hover:bg-transparent hover:text-red-600"
              asChild
            >
              <Link to="/business">{t("audience.switchToBusiness")}</Link>
            </Button>
          ) : null}
          {!isLoading && !isAuthenticated && audience === "business" ? (
            <Button
              variant="ghost"
              className="h-auto px-2 py-1 text-red-500 hover:bg-transparent hover:text-red-600"
              asChild
            >
              <Link to="/">{t("audience.switchToUser")}</Link>
            </Button>
          ) : null}

          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <span className="sr-only">{t("loading")}</span>
                <Skeleton className="h-5 w-24" aria-hidden />
              </>
            ) : isAuthenticated && state.user ? (
              <AccountMenuPopover session={state.user} />
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to={signUpHref}>{t("auth.signUp")}</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link to={loginHref}>{t("auth.signIn")}</Link>
                </Button>
              </>
            )}
            {isAuthenticated && state.user ? null : <LanguageSwitcher />}
          </div>
        </div>
      </div>
    </nav>
  );
}
