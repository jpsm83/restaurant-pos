import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { BrowserRouter } from "react-router-dom";
// Side-effect: registers i18next + react-i18next and runs `init` before the tree mounts.
import "./i18n/i18n";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./auth/store/AuthContext";
import Navbar from "./components/Navbar";
import { queryClient } from "./services/queryClient";
import { SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";

// Provider order: QueryClient outside Auth — token for `services/http` comes from `auth/api` module, not Context; Query stays mounted across auth transitions.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <TooltipProvider>
              {/* Explicit viewport height: provider tree may not pass height to children; scroll stays in the pane below Navbar. */}
              <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden">
                <Navbar />
                <SidebarProvider
                  defaultOpen={false}
                  className="flex min-h-0 min-w-0 w-full flex-1 flex-row overflow-hidden [&_[data-slot=sidebar-container]]:top-14 [&_[data-slot=sidebar-container]]:bottom-0 [&_[data-slot=sidebar-container]]:h-auto"
                >
                  {/* Row: sidebar layouts render [Sidebar gap + fixed rail | scrollable main]. Public routes are a single flex-1 column with their own overflow-y. */}
                  <div className="flex min-h-0 w-full min-w-0 flex-1 flex-row overflow-hidden overscroll-y-contain pt-14">
                    <App />
                  </div>
                </SidebarProvider>
              </div>
            </TooltipProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
      <Toaster richColors position="top-right" />
      {import.meta.env.DEV ? (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      ) : null}
    </QueryClientProvider>
  </StrictMode>,
);
