import { useLocation } from "react-router-dom";
import App from "@/App";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Paths where global chrome (navbar + top offset) would leave empty gaps if hidden piecemeal. */
const MINIMAL_CHROME_PATHS = new Set([
  "/forgot-password",
  "/reset-password",
  "/confirm-email",
]);

export default function AppRootShell() {
  const { pathname } = useLocation();
  const minimalChrome = MINIMAL_CHROME_PATHS.has(pathname);

  return (
    <TooltipProvider>
      <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden">
        {!minimalChrome ? <Navbar /> : null}
        <SidebarProvider
          defaultOpen={false}
          className={cn(
            "flex min-h-0 min-w-0 w-full flex-1 flex-row overflow-hidden [&_[data-slot=sidebar-container]]:bottom-0 [&_[data-slot=sidebar-container]]:h-auto",
            minimalChrome
              ? "[&_[data-slot=sidebar-container]]:top-0"
              : "[&_[data-slot=sidebar-container]]:top-14",
          )}
        >
          <div
            className={cn(
              "flex min-h-0 w-full min-w-0 flex-1 flex-row overflow-hidden overscroll-y-contain",
              minimalChrome ? "pt-0" : "pt-14",
            )}
          >
            <App />
          </div>
        </SidebarProvider>
      </div>
    </TooltipProvider>
  );
}
