import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { BusinessAccessLayer } from "restaurant-pos-packages/access";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import type { BusinessProfileSettingsReady } from "../hooks/useBusinessProfileSettingsController";
import {
  useBusinessProfileSettingsController,
  useBusinessProfileSettingsGate,
  type BusinessProfileSettingsGateReady,
  type BusinessProfileSettingsPageBlocked,
} from "../hooks/useBusinessProfileSettingsController";

/** Default “generic form” blocks when a page omits `loadingSlot`. */
function GenericSettingsFieldSkeletonBlocks() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" aria-hidden />
        <Skeleton className="h-24 w-full" aria-hidden />
      </div>
    </div>
  );
}

function FormActionsSkeletonRow() {
  return (
    <section className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
      <Skeleton className="h-10 w-28" aria-hidden />
      <Skeleton className="h-10 w-36" aria-hidden />
    </section>
  );
}

/**
 * Loading skeleton body + save-bar skeleton (no card wrapper).
 * Pages pass **`children`** to mirror their real form layout while profile data loads.
 */
export function BusinessProfileSettingsLoadingCard({
  children,
  showFormActionsSkeleton = true,
}: {
  children?: ReactNode;
  /** Split settings pages with no Save/Reset bar (e.g. credentials email flow) omit the bottom row. */
  showFormActionsSkeleton?: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <Skeleton className="h-4 w-full max-w-md" aria-hidden />
      <div className="space-y-8">
        {children ?? <GenericSettingsFieldSkeletonBlocks />}
      </div>
      {showFormActionsSkeleton ? <FormActionsSkeletonRow /> : null}
    </div>
  );
}

type BusinessProfileSettingsFormShellProps = {
  /**
   * Replaces the default loading body; use {@link BusinessProfileSettingsLoadingCard} with custom
   * children so each settings route mirrors its own form shape.
   */
  loadingSlot?: ReactNode;
  /** Minimum effective layer for the page; manager by default, admin for identity-only pages. */
  requiredLayer?: BusinessAccessLayer;
  children: (ctx: BusinessProfileSettingsReady) => ReactNode;
};

type BusinessProfileSettingsStaticShellProps = {
  loadingSlot?: ReactNode;
  /** No RHF, no Save/Reset — only profile gate + your content (e.g. email-based password change). */
  children: (ctx: BusinessProfileSettingsGateReady) => ReactNode;
};

function renderProfileSettingsBlockedMain(
  loadingSlot: ReactNode | undefined,
  blocked: BusinessProfileSettingsPageBlocked,
  t: TFunction<"business">,
  resolveError: (failure: ErrorFailure | null | undefined) => string,
): ReactNode {
  if (blocked.kind === "loading") {
    const loadingLabel = t("profile.loadingTitle");
    return (
      <main
        className="w-full min-w-0 p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={loadingLabel}
      >
        {loadingSlot ?? <BusinessProfileSettingsLoadingCard />}
      </main>
    );
  }

  if (blocked.kind === "error") {
    const message = blocked.failure
      ? resolveError(blocked.failure)
      : t("profile.loadError");
    return (
      <main className="w-full min-w-0 p-6">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("profile.errorTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("profile.errorDescription")}
          </p>
          <Alert>{message}</Alert>
          <Button
            type="button"
            variant="outline"
            onClick={() => void blocked.refetch()}
          >
            {t("profile.retry")}
          </Button>
        </div>
      </main>
    );
  }

  if (blocked.kind === "no-data") {
    return (
      <main className="w-full min-w-0 p-6">
        <Alert>{t("profile.noData")}</Alert>
      </main>
    );
  }

  if (blocked.kind === "forbidden") {
    const adminOnly = blocked.requiredLayer === "admin";
    return (
      <main className="w-full min-w-0 p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4" aria-hidden />
              {t(
                adminOnly
                  ? "settingsAccess.adminTitle"
                  : "settingsAccess.managerTitle",
              )}
            </CardTitle>
            <CardDescription>
              {t(
                adminOnly
                  ? "settingsAccess.adminDescription"
                  : "settingsAccess.managerDescription",
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return null;
}

/**
 * Read-only split settings shell: same load/error UX as {@link BusinessProfileSettingsFormShell}
 * without RHF, Save/Reset, or unsaved navigation guard.
 */
export function BusinessProfileSettingsStaticShell({
  loadingSlot,
  children,
}: BusinessProfileSettingsStaticShellProps) {
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const gate = useBusinessProfileSettingsGate();

  if (gate.kind !== "ready") {
    return renderProfileSettingsBlockedMain(loadingSlot, gate, t, resolveError);
  }

  return (
    <main className="w-full min-w-0 p-6">
      <div className="min-w-0">{children(gate)}</div>
    </main>
  );
}

/**
 * Shared layout for split business settings routes: query gate, RHF submit bar, unsaved navigation guard.
 * Page chrome (titles) live inside each route’s **`children`** content.
 */
export function BusinessProfileSettingsFormShell({
  loadingSlot,
  requiredLayer = "manager",
  children,
}: BusinessProfileSettingsFormShellProps) {
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const ctrl = useBusinessProfileSettingsController(requiredLayer);

  if (ctrl.kind !== "ready") {
    return renderProfileSettingsBlockedMain(loadingSlot, ctrl, t, resolveError);
  }

  const {
    handleSubmit,
    onSubmit,
    updateMutation,
    isDirty,
    handleResetToLastSaved,
    submitError,
    unsavedChangesGuard,
    onFormChangeCapture,
    isSubmitted,
    isValid,
  } = ctrl;

  return (
    <main className="w-full min-w-0 p-6">
      <form
        className="flex w-full min-w-0 flex-col gap-8"
        aria-busy={updateMutation.isPending ? "true" : "false"}
        onChangeCapture={onFormChangeCapture}
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      >
        <div className="min-w-0 space-y-8">
          {children(ctrl)}
          {isSubmitted && !isValid ? (
            <Alert>{t("profile.validationSummary")}</Alert>
          ) : null}
          {submitError ? <Alert>{resolveError(submitError)}</Alert> : null}
        </div>
        <section className="relative z-10 flex flex-wrap items-center justify-end gap-3 pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={updateMutation.isPending || !isDirty}
            onClick={handleResetToLastSaved}
          >
            {t("profile.reset")}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
            {updateMutation.isPending ? t("profile.saving") : t("profile.save")}
          </Button>
        </section>
      </form>
      <UnsavedChangesDialog
        open={unsavedChangesGuard.isDialogOpen}
        onStay={unsavedChangesGuard.stayOnPage}
        onLeave={unsavedChangesGuard.leavePage}
        isLeaving={unsavedChangesGuard.isLeaving}
      />
    </main>
  );
}
