import { type ChangeEvent, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Building2, Camera, ChevronDown } from "lucide-react";
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
} from "@packages/enums.ts";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

const CONTACT_SELECT_NONE = "__none__";

/** Loading layout mirrors `BusinessProfileSections`: one section, header, logo + two fields, then the 7-cell grid. */
function ProfileSettingsLoadingBody() {
  const fieldSkeleton = (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-4 w-28" aria-hidden />
      <Skeleton className="h-10 w-full" aria-hidden />
    </div>
  );
  const selectSkeleton = (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-4 w-28" aria-hidden />
      <Skeleton className="h-8 w-full" aria-hidden />
    </div>
  );

  return (
    <>
      <section className="space-y-4">
        <header className="space-y-1.5">
          <Skeleton className="h-4 w-40" aria-hidden />
          <Skeleton className="h-3 w-full max-w-lg" aria-hidden />
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              className="text-sm font-semibold text-neutral-800 md:sr-only"
              aria-hidden
            >
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton
              className="h-28 w-36 max-w-full rounded-lg border border-neutral-300 sm:w-44"
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" aria-hidden />
              <Skeleton className="h-10 w-full" aria-hidden />
            </div>
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" aria-hidden />
              <Skeleton className="h-10 w-full" aria-hidden />
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
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,24rem)] p-2"
          align="start"
        >
          <div className="max-h-60 space-y-2 overflow-y-auto p-1">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-neutral-100"
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
          className="text-xs leading-snug wrap-break-word text-neutral-600"
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
  const {
    register,
    control,
    setValue,
    handleImageUpload,
    imagePreviewUrl,
    imageUrl,
    managementContactRows,
  } = ctx;

  const hasImage = Boolean(imagePreviewUrl || imageUrl);

  return (
    <>
      <section className="space-y-4">
        <header className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            {t("profileSettings.core.sectionTitle")}
          </h2>
          <p className="text-sm text-neutral-600">
            {t("profileSettings.core.sectionDescription")}
          </p>
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-800 md:sr-only">
              {t("profileSettings.logo.sectionTitle")}
            </h3>
            <div className="group relative flex h-28 w-fit max-w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100">
              {hasImage ? (
                <img
                  src={imagePreviewUrl ?? imageUrl}
                  alt={t("profileSettings.logo.logoAlt")}
                  className="h-full w-auto max-w-[min(100%,20rem)] object-contain"
                />
              ) : (
                <div className="flex h-full min-w-28 items-center justify-center px-6 text-neutral-500">
                  <Building2 className="h-10 w-10 shrink-0" aria-hidden />
                </div>
              )}
              <label
                htmlFor="bp-image-file"
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                {t("profileSettings.logo.uploadLabel")}
              </label>
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

          <div className="min-w-0 flex-1 space-y-4">
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
          </div>
        </div>
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
                <Select value={field.value} onValueChange={field.onChange}>
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
            <Label htmlFor="bp-email">
              {t("profileSettings.core.fields.email")}
            </Label>
            <Input
              id="bp-email"
              type="email"
              autoComplete="email"
              {...register("email", {
                onChange: (e: ChangeEvent<HTMLInputElement>) => {
                  // Single email field here: keep confirmEmail aligned for Zod (credentials page uses two fields).
                  setValue("confirmEmail", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                },
              })}
            />
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
