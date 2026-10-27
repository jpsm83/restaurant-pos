import { type ChangeEvent, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Camera,
  ChevronDown,
  CircleCheck,
  Mail,
} from "lucide-react";
import { refreshSession } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { useResendEmailConfirmation } from "@/hooks/useResendEmailConfirmation";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  currenctyEnums,
  cuisineTypeEnums,
  foodSubCategoryEnums,
} from "restaurant-pos-packages/enums";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import { useChangeBusinessEmailController } from "../../hooks/useChangeBusinessEmailController";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

const CONTACT_SELECT_NONE = "__none__";

/** Loading layout mirrors `BusinessProfileSections`: header, logo+fields grid (1 / 2 / 3 cols), then the 6-cell grid. */
function ProfileSettingsLoadingBody() {
  const fieldSkeleton = (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
  const selectSkeleton = (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-full" />
    </div>
  );

  return (
    <>
      <section className="space-y-4">
        <header className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-lg" />
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8 lg:items-start">
          <div className="flex min-w-0 flex-col items-center gap-2 justify-self-center md:justify-self-start lg:justify-self-center">
            <div className="text-sm font-semibold text-foreground md:sr-only">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-44 w-full max-w-54 rounded-lg border border-border md:max-w-60 lg:max-w-68" />
          </div>

          <div className="min-w-0 space-y-4 md:col-span-1 lg:col-span-2">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex shrink-0 justify-start sm:justify-end sm:pb-0.5">
                <Skeleton className="h-9 w-40" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fieldSkeleton}
          {fieldSkeleton}
          {selectSkeleton}
          {fieldSkeleton}
          {selectSkeleton}
          {selectSkeleton}
          {selectSkeleton}
        </div>
      </section>
    </>
  );
}

/** Popover + checkboxes: multiple values from `packages/enums.ts` only. */
function ProfileEnumMultiSelect<T extends string>({
  id,
  label,
  values,
  options,
  onChange,
  emptyLabel,
  summaryLabel,
}: {
  id: string;
  label: string;
  values: T[];
  options: readonly T[];
  onChange: (next: T[]) => void;
  emptyLabel: string;
  summaryLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const summaryId = `${id}-selected-list`;
  const showSelectedSummary = values.length >= 3;

  const triggerText = useMemo(() => {
    if (values.length === 0) return emptyLabel;
    if (values.length <= 2) return values.join(", ");
    return summaryLabel.replace("{{count}}", String(values.length));
  }, [values, emptyLabel, summaryLabel]);

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            className="h-8 w-full min-w-0 justify-between px-2.5 font-normal"
            aria-expanded={open}
            aria-describedby={showSelectedSummary ? summaryId : undefined}
          >
            <span className="truncate text-left">{triggerText}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) max-w-96 p-2"
          align="start"
        >
          <div className="max-h-60 space-y-2 overflow-y-auto p-1">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  checked={values.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = new Set(values);
                    if (checked === true) next.add(opt);
                    else next.delete(opt);
                    onChange(Array.from(next).sort() as T[]);
                  }}
                />
                <span className="min-w-0 flex-1">{opt}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {showSelectedSummary ? (
        <p
          id={summaryId}
          className="text-xs leading-snug wrap-break-word text-muted-foreground"
          aria-live="polite"
        >
          {values.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Logo, core business fields, cuisine type, and discovery categories (`/business/:id/settings/profile`). */
export default function BusinessProfileSettingsPage() {
  return (
    <BusinessProfileSettingsFormShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <ProfileSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <BusinessProfileSections ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function BusinessProfileSections({
  ctx,
}: {
  ctx: BusinessProfileSettingsReady;
}) {
  const { t } = useTranslation("business");
  const { dispatch } = useAuth();
  const {
    register,
    control,
    handleImageUpload,
    imagePreviewUrl,
    imageUrl,
    managementContactRows,
    profileQuery,
  } = ctx;

  const hasImage = Boolean(imagePreviewUrl || imageUrl);
  // Profile GET is authoritative for `emailVerified`; JWT can lag until refresh/login.
  const emailVerified = profileQuery.data?.emailVerified === true;
  // Timezone is derived server-side from the business address (read-only here).
  const timezone = profileQuery.data?.timezone?.trim() || "UTC";
  const timezoneIsDefault = profileQuery.data?.timezoneIsDefault === true;
  const changeEmail = useChangeBusinessEmailController(
    profileQuery.data?.email ?? "",
  );

  async function syncSessionAndProfileAfterEmailFlow() {
    const refreshed = await refreshSession();
    if (refreshed.ok && refreshed.data?.user) {
      dispatch({ type: "AUTH_SUCCESS", payload: refreshed.data.user });
    }
    await profileQuery.refetch();
  }

  const { resend: resendConfirmation, pending: resendPending } =
    useResendEmailConfirmation({
      successMessage: t("credentialsSettings.emailVerify.resendSuccess"),
      onSuccess: syncSessionAndProfileAfterEmailFlow,
    });

  return (
    <>
      <section className="space-y-4">
        <header className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {t("profileSettings.core.sectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("profileSettings.core.sectionDescription")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8 lg:items-start">

          {/* Logo section */}
          <div className="flex flex-col items-center gap-2 justify-self-center h-auto w-auto">
            <div
              className="group relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
            >
              {hasImage ? (
                <img
                  src={imagePreviewUrl ?? imageUrl}
                  alt={t("profileSettings.logo.logoAlt")}
                  className="block object-contain"
                />
              ) : (
                <div className="flex items-center justify-center text-muted-foreground">
                  <Building2 className="h-14 w-14 shrink-0" />
                </div>
              )}
              <Label
                htmlFor="bp-image-file"
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-primary/80 text-xs font-medium text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="mr-1 h-4 w-4 shrink-0" />
                {t("profileSettings.logo.uploadLabel")}
              </Label>
            </div>
            <Input
              id="bp-image-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handleImageUpload(event)
              }
            />
          </div>

          {/* Core business info section */}
          <div className="min-w-0 space-y-4 md:col-span-1 lg:col-span-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="bp-trade-name">
                {t("profileSettings.core.fields.tradeName")}
              </Label>
              <Input
                id="bp-trade-name"
                autoComplete="organization"
                {...register("tradeName")}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="bp-legal-name">
                {t("profileSettings.core.fields.legalName")}
              </Label>
              <Input id="bp-legal-name" {...register("legalName")} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="bp-email">
                  {t("profileSettings.core.fields.email")}
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="bp-email"
                    type="email"
                    autoComplete="email"
                    readOnly
                    aria-readonly="true"
                    className="sm:flex-1"
                    value={profileQuery.data?.email ?? ""}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={changeEmail.openDialog}
                  >
                    {t("profileSettings.core.changeEmailCta")}
                  </Button>
                </div>
                {changeEmail.pendingEmail ? (
                  <p
                    role="status"
                    className="rounded-md bg-warning/20 px-2 py-1 text-xs leading-snug text-foreground"
                  >
                    {t("profileSettings.core.pendingEmail", {
                      email: changeEmail.pendingEmail,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-stretch justify-end sm:items-end sm:pb-0.5">
                {emailVerified ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-success">
                    <CircleCheck
                      className="size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span>
                      {t("profileSettings.core.emailVerification.confirmed")}
                    </span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-0 justify-start gap-2 px-2 py-2 bg-destructive/10 text-sm font-medium text-destructive no-underline hover:no-underline hover:cursor-pointer hover:text-destructive disabled:opacity-60 hover:bg-destructive/20 sm:justify-end"
                    disabled={resendPending}
                    onClick={() => void resendConfirmation()}
                  >
                    <Mail
                      className="size-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                    {t("profileSettings.core.emailVerification.confirmCta")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <ChangeEmailDialog controller={changeEmail} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="bp-phone">
              {t("profileSettings.core.fields.phoneNumber")}
            </Label>
            <Input
              id="bp-phone"
              autoComplete="tel"
              {...register("phoneNumber")}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="bp-tax-number">
              {t("profileSettings.core.fields.taxNumber")}
            </Label>
            <Input id="bp-tax-number" {...register("taxNumber")} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="bp-currency">
              {t("profileSettings.core.fields.currencyTrade")}
            </Label>
            <Controller
              name="currencyTrade"
              control={control}
              render={({ field }) => (
                <Select
                  key={`bp-currency-${profileQuery.dataUpdatedAt}`}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id="bp-currency"
                    className="h-8 w-full min-w-0"
                  >
                    <SelectValue
                      placeholder={t(
                        "profileSettings.selects.currencyPlaceholder",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {currenctyEnums.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="bp-timezone">
              {t("profileSettings.core.fields.timezone")}
            </Label>
            <Input
              id="bp-timezone"
              value={timezone}
              readOnly
              aria-describedby={
                timezoneIsDefault ? "bp-timezone-hint" : undefined
              }
            />
            {timezoneIsDefault ? (
              <p
                id="bp-timezone-hint"
                className="rounded-md bg-warning/20 px-2 py-1 text-xs leading-snug text-foreground"
              >
                {t("profileSettings.core.timezoneDefaultHint")}
              </p>
            ) : null}
          </div>
          <Controller
            name="cuisineType"
            control={control}
            render={({ field }) => (
              <ProfileEnumMultiSelect
                id="bp-cuisine-type"
                label={t("profileSettings.discovery.fields.cuisineType")}
                values={field.value}
                options={cuisineTypeEnums}
                onChange={field.onChange}
                emptyLabel={t("profileSettings.selects.multiEmpty")}
                summaryLabel={t("profileSettings.selects.multiSummary")}
              />
            )}
          />
          <Controller
            name="categories"
            control={control}
            render={({ field }) => (
              <ProfileEnumMultiSelect
                id="bp-categories"
                label={t("profileSettings.discovery.fields.categories")}
                values={field.value}
                options={foodSubCategoryEnums}
                onChange={field.onChange}
                emptyLabel={t("profileSettings.selects.multiEmpty")}
                summaryLabel={t("profileSettings.selects.multiSummary")}
              />
            )}
          />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="bp-contact-person">
              {t("profileSettings.core.fields.contactPerson")}
            </Label>
            <Controller
              name="contactPerson"
              control={control}
              render={({ field }) => {
                const hasMatch = managementContactRows.some(
                  (r) => r.employeeId === field.value,
                );
                const selectValue =
                  field.value && hasMatch ? field.value : CONTACT_SELECT_NONE;
                return (
                  <Select
                    value={selectValue}
                    onValueChange={(v) =>
                      field.onChange(v === CONTACT_SELECT_NONE ? "" : v)
                    }
                  >
                    <SelectTrigger
                      id="bp-contact-person"
                      className="h-8 w-full min-w-0"
                    >
                      <SelectValue
                        placeholder={t(
                          "profileSettings.selects.contactPlaceholder",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CONTACT_SELECT_NONE}>
                        {t("profileSettings.selects.contactNone")}
                      </SelectItem>
                      {managementContactRows.map((row) => (
                        <SelectItem key={row.employeeId} value={row.employeeId}>
                          {row.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
