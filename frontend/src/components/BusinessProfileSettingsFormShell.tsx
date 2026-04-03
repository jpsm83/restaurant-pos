import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BusinessProfileSettingsReady } from "../hooks/useBusinessProfileSettingsController";
import { useBusinessProfileSettingsController } from "../hooks/useBusinessProfileSettingsController";

type BusinessProfileSettingsFormShellProps = {
  /** Page `<h1>` (and default card title if `cardTitle` omitted). */
  pageTitle: string;
  cardTitle?: string;
  cardDescription?: string;
  children: (ctx: BusinessProfileSettingsReady) => ReactNode;
};

/**
 * Shared layout for split business settings routes: query gate, RHF submit bar, unsaved navigation guard.
 */
export function BusinessProfileSettingsFormShell({
  pageTitle,
  cardTitle,
  cardDescription,
  children,
}: BusinessProfileSettingsFormShellProps) {
  const { t } = useTranslation("business");
  const ctrl = useBusinessProfileSettingsController();

  if (ctrl.kind === "wrong-session") {
    return null;
  }

  if (ctrl.kind === "no-business-id") {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{pageTitle}</h1>
        <Alert>
          {t("profile.invalidRoute", { defaultValue: "Business route is invalid." })}
        </Alert>
      </main>
    );
  }

  if (ctrl.kind === "loading") {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{pageTitle}</h1>
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>
              {t("profile.loadingTitle", { defaultValue: "Loading business profile..." })}
            </CardTitle>
            <CardDescription>
              {t("profile.loadingDescription", {
                defaultValue: "Fetching the latest business data before rendering the form.",
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (ctrl.kind === "error") {
    const message =
      ctrl.message ??
      t("profile.loadError", { defaultValue: "Failed to load business profile." });
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{pageTitle}</h1>
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>
              {t("profile.errorTitle", { defaultValue: "Could not load profile" })}
            </CardTitle>
            <CardDescription>
              {t("profile.errorDescription", {
                defaultValue: "Review the error and retry profile fetch.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>{message}</Alert>
            <Button
              type="button"
              variant="outline"
              onClick={() => void ctrl.refetch()}
            >
              {t("profile.retry", { defaultValue: "Retry" })}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (ctrl.kind === "no-data") {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{pageTitle}</h1>
        <Alert>
          {t("profile.noData", {
            defaultValue: "No profile data was returned. Please retry.",
          })}
        </Alert>
      </main>
    );
  }

  // Explicit ready narrow — union uses `Exclude<>` for blocked kinds; TS needs this for destructuring.
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
    <main className="min-h-0 flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">{pageTitle}</h1>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>{cardTitle ?? pageTitle}</CardTitle>
          {cardDescription ? <CardDescription>{cardDescription}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <form
            className="space-y-8"
            aria-busy={updateMutation.isPending ? "true" : "false"}
            onChangeCapture={onFormChangeCapture}
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          >
            {children(ctrl)}
            {submitError ? <Alert>{submitError}</Alert> : null}
            <section className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending || !isDirty}
                onClick={handleResetToLastSaved}
              >
                Reset changes
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </section>
          </form>
        </CardContent>
      </Card>
      <UnsavedChangesDialog
        open={unsavedChangesGuard.isDialogOpen}
        onStay={unsavedChangesGuard.stayOnPage}
        onLeave={unsavedChangesGuard.leavePage}
        isLeaving={unsavedChangesGuard.isLeaving}
      />
    </main>
  );
}
