import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessProfileSettingsReady } from "../hooks/useBusinessProfileSettingsController";
import { useBusinessProfileSettingsController } from "../hooks/useBusinessProfileSettingsController";

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
    <section className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 pt-5">
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
}: {
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <Skeleton className="h-4 w-full max-w-md" aria-hidden />
      <div className="space-y-8">
        {children ?? <GenericSettingsFieldSkeletonBlocks />}
      </div>
      <FormActionsSkeletonRow />
    </div>
  );
}

type BusinessProfileSettingsFormShellProps = {
  /** Page `<h1>` (and default section title if `cardTitle` omitted). */
  pageTitle: string;
  cardDescription?: string;
  /**
   * Replaces the default loading body; use {@link BusinessProfileSettingsLoadingCard} with custom
   * children so each settings route mirrors its own form shape.
   */
  loadingSlot?: ReactNode;
  children: (ctx: BusinessProfileSettingsReady) => ReactNode;
};

/**
 * Shared layout for split business settings routes: query gate, RHF submit bar, unsaved navigation guard.
 * Full-width page content (no card); typography matches former card title/description.
 */
export function BusinessProfileSettingsFormShell({
  pageTitle,
  loadingSlot,
  children,
}: BusinessProfileSettingsFormShellProps) {
  const { t } = useTranslation("business");
  const ctrl = useBusinessProfileSettingsController();

  if (ctrl.kind === "loading") {
    const loadingLabel = t("profile.loadingTitle", {
      defaultValue: "Loading business profile...",
    });
    return (
      <main
        className="w-full min-w-0 p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={loadingLabel}
      >
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-neutral-900">
          {pageTitle}
        </h1>
        {loadingSlot ?? <BusinessProfileSettingsLoadingCard />}
      </main>
    );
  }

  if (ctrl.kind === "error") {
    const message =
      ctrl.message ??
      t("profile.loadError", {
        defaultValue: "Failed to load business profile.",
      });
    return (
      <main className="w-full min-w-0 p-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-neutral-900">
          {pageTitle}
        </h1>
        <div className="max-w-2xl space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            {t("profile.errorTitle", {
              defaultValue: "Could not load profile",
            })}
          </h2>
          <p className="text-sm text-neutral-600">
            {t("profile.errorDescription", {
              defaultValue: "Review the error and retry profile fetch.",
            })}
          </p>
          <Alert>{message}</Alert>
          <Button
            type="button"
            variant="outline"
            onClick={() => void ctrl.refetch()}
          >
            {t("profile.retry", { defaultValue: "Retry" })}
          </Button>
        </div>
      </main>
    );
  }

  if (ctrl.kind === "no-data") {
    return (
      <main className="w-full min-w-0 p-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-neutral-900">
          {pageTitle}
        </h1>
        <Alert>
          {t("profile.noData", {
            defaultValue: "No profile data was returned. Please retry.",
          })}
        </Alert>
      </main>
    );
  }

  if (ctrl.kind !== "ready") {
    return null;
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
          {submitError ? <Alert>{submitError}</Alert> : null}
        </div>
        <section className="relative z-10 flex flex-wrap items-center justify-end gap-3 pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={updateMutation.isPending || !isDirty}
            onClick={handleResetToLastSaved}
          >
            Reset changes
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending || !isDirty}
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
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
