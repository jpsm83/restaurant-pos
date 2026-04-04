import { useMemo, type ChangeEvent } from "react";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Building2, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";

function ProfileSettingsLoadingBody() {
  return (
    <>
      <section className="space-y-3">
        <Skeleton className="h-4 w-16" aria-hidden />
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-28 w-28 shrink-0 rounded-full" aria-hidden />
          <div className="min-w-[220px] flex-1 space-y-2">
            <Skeleton className="h-4 w-full" aria-hidden />
            <Skeleton className="h-4 w-full max-w-xs" aria-hidden />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <Skeleton className="h-4 w-40" aria-hidden />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Skeleton className="h-4 w-24" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Skeleton className="h-4 w-24" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Skeleton className="h-4 w-32" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <Skeleton className="h-4 w-28" aria-hidden />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
        </div>
      </section>
    </>
  );
}

/** Logo, core business fields, cuisine type, and discovery categories (`/business/:id/settings/profile`). */
export default function BusinessProfileSettingsPage() {
  const { t } = useTranslation("business");
  const { t: tNav } = useTranslation("nav");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.profile")}
      cardTitle={t("profile.formScaffoldTitle", { defaultValue: "Business profile form" })}
      cardDescription={t("profile.formScaffoldDescription", {
        defaultValue:
          "Update your public-facing business identity, logo, and how customers discover you.",
      })}
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <ProfileSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => (
        <BusinessProfileSections ctx={ctx} />
      )}
    </BusinessProfileSettingsFormShell>
  );
}

function BusinessProfileSections({
  ctx,
}: {
  ctx: import("../../hooks/useBusinessProfileSettingsController").BusinessProfileSettingsReady;
}) {
  const { register, control, setValue, handleImageUpload, imagePreviewUrl, imageUrl, imageFile } =
    ctx;
  const categories = useWatch({ control, name: "categories" }) ?? [];

  const imageHint = useMemo(() => {
    if (imageFile) return `Selected file: ${imageFile.name}`;
    if (imageUrl) return "Current logo comes from the last saved cloud image URL.";
    return "Hover the avatar and upload a logo file.";
  }, [imageFile, imageUrl]);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="group relative h-28 w-28 overflow-hidden rounded-full border border-neutral-300 bg-neutral-100">
            {imagePreviewUrl || imageUrl ? (
              <img
                src={imagePreviewUrl ?? imageUrl}
                alt="Business logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-500">
                <Building2 className="h-10 w-10" />
              </div>
            )}
            <label
              htmlFor="bp-image-file"
              className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Camera className="mr-1 h-4 w-4" />
              Upload
            </label>
          </div>
          <div className="min-w-[220px] flex-1 space-y-2">
            <Input
              id="bp-image-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => handleImageUpload(event)}
            />
            <p className="text-xs text-neutral-500">{imageHint}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Core business info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bp-trade-name">Trade name</Label>
            <Input id="bp-trade-name" autoComplete="organization" {...register("tradeName")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bp-legal-name">Legal name</Label>
            <Input id="bp-legal-name" {...register("legalName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-email">Business email</Label>
            <Input id="bp-email" type="email" autoComplete="email" {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-phone">Phone number</Label>
            <Input id="bp-phone" autoComplete="tel" {...register("phoneNumber")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-tax-number">Tax number</Label>
            <Input id="bp-tax-number" {...register("taxNumber")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-currency">Currency</Label>
            <Input id="bp-currency" {...register("currencyTrade")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bp-contact-person">Contact person</Label>
            <Input id="bp-contact-person" {...register("contactPerson")} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Discovery
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp-cuisine-type">Cuisine type</Label>
            <Input id="bp-cuisine-type" {...register("cuisineType")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-categories">Categories (comma separated)</Label>
            <Input
              id="bp-categories"
              value={categories.join(", ")}
              onChange={(event) =>
                setValue(
                  "categories",
                  event.target.value
                    .split(",")
                    .map((category) => category.trim())
                    .filter(Boolean),
                  { shouldDirty: true },
                )
              }
            />
          </div>
        </div>
      </section>
    </>
  );
}
