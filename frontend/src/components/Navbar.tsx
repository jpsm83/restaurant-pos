import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
import { useSiteAudience } from "@/context/SiteAudienceContext";
import { Button } from "@/components/ui/button";

/**
 * Top bar for **public** marketing and auth routes only (Phase 1.2).
 * Cross-audience link (Business vs User) is hidden once authenticated (strategy §4.1b).
 */
export default function Navbar() {
  const { state } = useAuth();
  const audience = useSiteAudience();
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
      aria-label="Main marketing navigation"
    >
      <div className="flex w-full items-center justify-between gap-3 px-6 sm:px-8 py-2">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/imperium.png"
              alt=""
              className="h-8 w-10 object-contain"
              width={32}
              height={32}
            />
            <span className="text-md font-semibold text-neutral-800">
              Project Imperium POS
            </span>
          </Link>
        </div>

        <div className="flex items-center text-red-600 text-decoration-none gap-4 text-sm">
          {!isLoading && !isAuthenticated && audience === "customer" ? (
            <Link to="/business">Switch to Business</Link>
          ) : null}
          {!isLoading && !isAuthenticated && audience === "business" ? (
            <Link to="/">Switch to User</Link>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-neutral-600">Loading...</p>
          ) : isAuthenticated && state.user ? (
            <AccountMenuPopover session={state.user} />
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to={signUpHref}>Sign up</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={loginHref}>Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
