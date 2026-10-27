import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/store/AuthContext";
import { useLiveConnectionStatus } from "@/live/useLiveConnectionStatus";
import { cn } from "@/lib/utils";

/**
 * Signed-in chrome only. Guest and recovery pages must not show this state.
 * The last known screen stays visible underneath.
 */
export default function LiveConnectionBanner() {
  const { t } = useTranslation("common");
  const { state } = useAuth();
  const status = useLiveConnectionStatus();

  const signedIn = state.status === "authenticated" && Boolean(state.user);
  if (!signedIn || (status !== "disconnected" && status !== "reconnecting")) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "fixed left-0 right-0 top-14 z-sticky border-b px-4 py-1.5 text-center text-sm font-medium",
        status === "disconnected"
          ? "border-warning/40 bg-warning/20 text-foreground"
          : "border-info/30 bg-info/10 text-foreground",
      )}
    >
      {status === "disconnected"
        ? t("live.disconnected")
        : t("live.reconnecting")}
    </div>
  );
}
