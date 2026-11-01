/**
 * Localized explanation shown in the Customer surface after a mode guard
 * redirects away from a Business destination.
 *
 * Guards attach a `ModeNoticeNavigationState` to the redirect; this component
 * translates the machine code at render time so the copy follows the active UI
 * language.
 */
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Alert } from "@/components/ui/alert";

/** Localized explanation codes carried on a guard redirect to the Customer surface. */
export type ModeNoticeCode =
  | "businessUnavailable"
  | "businessCheckFailed"
  | "modeLoadFailed"
  | "modeSwitchFailed";

export interface ModeNoticeNavigationState {
  modeNotice?: ModeNoticeCode;
}

export function ModeNotice() {
  const { t } = useTranslation("mode");
  const { state } = useLocation();
  const notice = (state as ModeNoticeNavigationState | null)?.modeNotice;

  const copy =
    notice === "businessUnavailable"
      ? t("guard.businessUnavailable")
      : notice === "businessCheckFailed"
        ? t("guard.businessCheckFailed")
        : notice === "modeLoadFailed"
          ? t("guard.modeLoadFailed")
          : notice === "modeSwitchFailed"
            ? t("guard.modeSwitchFailed")
            : null;

  if (!copy) return null;

  return (
    <div className="px-6 pt-4">
      <Alert>{copy}</Alert>
    </div>
  );
}
