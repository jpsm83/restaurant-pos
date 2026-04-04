import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

function CredentialsSettingsLoadingBody() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" aria-hidden />
        <Skeleton className="h-9 w-40" aria-hidden />
      </div>
      <Skeleton className="h-4 w-full max-w-xl" aria-hidden />
    </section>
  );
}

/** Login email confirmation and optional password rotation for the business account. */
export default function BusinessCredentialsSettingsPage() {
  const { t: tNav } = useTranslation("nav");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.credentials")}
      cardDescription="Changing email or password may require signing in again after save."
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <CredentialsSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <CredentialsSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function CredentialsSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { register } = ctx;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Credentials
        </h2>
        <Button type="button" variant="outline" onClick={() => setIsExpanded((c) => !c)}>
          {isExpanded ? "Hide credentials" : "Update credentials"}
        </Button>
      </div>
      {isExpanded ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp-confirm-email">Confirm email</Label>
            <Input id="bp-confirm-email" type="email" {...register("confirmEmail")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-password">New password</Label>
            <Input id="bp-password" type="password" {...register("password")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-confirm-password">Confirm password</Label>
            <Input id="bp-confirm-password" type="password" {...register("confirmPassword")} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Keep this section collapsed when you are not changing login credentials.
        </p>
      )}
    </section>
  );
}
