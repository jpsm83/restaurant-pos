import { useTranslation } from "react-i18next";
import { FieldError } from "@/components/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

/** Loading layout: two columns (note + two fields each), then full-width current password row. */
function CredentialsSettingsLoadingBody() {
  const column = (
    <div className="flex min-w-0 flex-col gap-4">
      <Skeleton className="h-12 w-full" aria-hidden />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <Skeleton className="h-4 w-44" aria-hidden />
        <Skeleton className="h-3 w-full max-w-lg" aria-hidden />
      </header>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {column}
        {column}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
      </div>
    </section>
  );
}

export default function BusinessCredentialsSettingsPage() {
  const { t: tNav } = useTranslation("nav");
  const { t } = useTranslation("business");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.credentials")}
      cardDescription={t("credentialsSettings.cardDescription")}
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
  const { t } = useTranslation("business");
  const { register, errors } = ctx;

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          {t("credentialsSettings.sectionTitle")}
        </h2>
        <p className="text-sm text-neutral-600">
          {t("credentialsSettings.sectionDescription")}
        </p>
      </header>

      <hr className="my-8 border-neutral-200" />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-note">
              {t("credentialsSettings.fields.note")}
            </Label>
            <p className="text-sm text-neutral-600">
              {t("credentialsSettings.columnHintEmail")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-email">
              {t("credentialsSettings.fields.email")}
            </Label>
            <Input
              id="bp-credentials-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-confirm-email">
              {t("credentialsSettings.fields.confirmEmail")}
            </Label>
            <Input
              id="bp-credentials-confirm-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.confirmEmail ? true : undefined}
              {...register("confirmEmail")}
            />
            <FieldError message={errors.confirmEmail?.message} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-note">
              {t("credentialsSettings.fields.note")}
            </Label>
            <p className="text-sm text-neutral-600">
              {t("credentialsSettings.columnHintPassword")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-new-password">
              {t("credentialsSettings.fields.newPassword")}
            </Label>
            <Input
              id="bp-credentials-new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-credentials-confirm-password">
              {t("credentialsSettings.fields.confirmPassword")}
            </Label>
            <Input
              id="bp-credentials-confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              {...register("confirmPassword")}
            />
            <FieldError message={errors.confirmPassword?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bp-credentials-current-password">
            {t("credentialsSettings.fields.currentPassword")}
          </Label>
          <Input
            id="bp-credentials-current-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.currentPassword ? true : undefined}
            {...register("currentPassword")}
          />
          <FieldError message={errors.currentPassword?.message} />
        </div>
      </div>
    </section>
  );
}
