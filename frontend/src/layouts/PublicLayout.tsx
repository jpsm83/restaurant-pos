import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { SiteAudienceProvider } from "@/context/SiteAudienceContext";
import Footer from "@/components/Footer";

/**
 * Public marketing + auth shell. Mounted at `path="/"` in `App.tsx` with nested child routes (Phase 1.4).
 * Site footer (`Footer`) is rendered only here, not on authenticated shells.
 */
export default function PublicLayout() {
  return (
    <SiteAudienceProvider>
      <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
        <Navbar />
        <Outlet />
        <Footer />
      </div>
    </SiteAudienceProvider>
  );
}
