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

// Provider order: QueryClient outside Auth — token for `services/http` comes from `auth/api` module, not Context; Query stays mounted across auth transitions.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <SidebarProvider defaultOpen={false} className="flex-col">
              <Navbar />
              <div className="flex min-h-0 w-full flex-1 pt-14">
                <App />
              </div>
            </SidebarProvider>
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
