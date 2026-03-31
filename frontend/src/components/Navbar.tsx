import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useOptionalSiteAudience } from "@/context/SiteAudienceContext";
import { Button } from "@/components/ui/button";

/**
 * App-wide top bar. Public routes: audience switch + auth CTAs (`SiteAudienceProvider`).
 * Authenticated shells: account popover with actor-specific links.
 */
export default function Navbar() {
  const { t } = useTranslation("nav");
  const { state } = useAuth();
  const audience = useOptionalSiteAudience() ?? "customer";
  const isAuthenticated =
    state.status === "authenticated" && Boolean(state.user);
  const isLoading = state.status === "loading" || state.status === "idle";

  const loginHref = `/login?audience=${audience}`;
  const signUpHref =
    audience === "business"
      ? "/business/register"
      : "/signup?audience=customer";

  return (
    <nav
      className="shrink-0 border-b border-neutral-200 bg-white"
      aria-label={t("mainNav.ariaLabel")}
    >
      <div className="flex w-full items-center justify-between gap-3 px-6 sm:px-8 py-2">
        <div>
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
            <Link to="/business" className="text-red-500 text-decoration-none">{t("audience.switchToBusiness")}</Link>
          ) : null}
          {!isLoading && !isAuthenticated && audience === "business" ? (
            <Link to="/" className="text-red-500 text-decoration-none">{t("audience.switchToUser")}</Link>
          ) : null}

          <div className="flex items-center gap-3">
            {isLoading ? (
              <p className="text-sm text-neutral-600">{t("loading")}</p>
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
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
}
