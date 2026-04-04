import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BusinessAddressLocationMap } from "@/components/BusinessAddressLocationMap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { businessDtoToFormValues } from "@/services/businessService";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

function AddressSettingsLoadingBody() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-4 w-24" aria-hidden />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={
                i === 4 ? "space-y-2 sm:col-span-2 xl:col-span-3" : "space-y-2"
              }
            >
              <Skeleton className="h-4 w-20" aria-hidden />
              <Skeleton className="h-10 w-full" aria-hidden />
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-2 lg:col-span-1">
        <Skeleton className="h-4 w-36" aria-hidden />
        <Skeleton
          className="h-64 min-h-64 w-full rounded-lg md:h-[min(50vh,22rem)] md:min-h-72"
          aria-hidden
        />
        <Skeleton className="h-3 w-full max-w-sm" aria-hidden />
      </div>
    </div>
  );
}

/** Street address and region fields for the business profile. */
export default function BusinessAddressSettingsPage() {
  const { t: tNav } = useTranslation("nav");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.address")}
      cardDescription="Postal and location details used on records and discovery."
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <AddressSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <AddressSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

/** Map geocoding only: omit unit-level fields that confuse Nominatim. */
function buildAddressGeocodeQuery(
  address:
    | {
        country?: string;
        state?: string;
        city?: string;
        street?: string;
        buildingNumber?: string;
        postCode?: string;
        region?: string;
      }
    | undefined,
): string {
  if (!address) return "";
  // Street-first ordering matches how Nominatim / postal geocoders parse queries best.
  return [
    address.street,
    address.buildingNumber,
    address.city,
    address.state,
    address.postCode,
    address.region,
    address.country,
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function AddressSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { register, control, isDirty, profileQuery } = ctx;
  const watched = useWatch({ control, name: "address" });

  const savedAddressQuery = useMemo(() => {
    const d = profileQuery.data;
    if (!d) return "";
    return buildAddressGeocodeQuery(businessDtoToFormValues(d).address);
  }, [profileQuery.data]);

  const addressQuery = useMemo(() => {
    const live = buildAddressGeocodeQuery(watched);
    if (live.length > 0) return live;
    if (!isDirty) return savedAddressQuery;
    return "";
  }, [watched, isDirty, savedAddressQuery]);

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Address
        </h2>
        <p className="text-sm text-neutral-600">
          Postal and location details used on records and delivery orders.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bp-country">Country</Label>
              <Input id="bp-country" {...register("address.country")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-state">State</Label>
              <Input id="bp-state" {...register("address.state")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-region">Region</Label>
              <Input id="bp-region" {...register("address.region")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-city">City</Label>
              <Input id="bp-city" {...register("address.city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-post-code">Post code</Label>
              <Input id="bp-post-code" {...register("address.postCode")} />
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Label htmlFor="bp-street">Street</Label>
              <Input id="bp-street" {...register("address.street")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-building-number">Building number</Label>
              <Input
                id="bp-building-number"
                {...register("address.buildingNumber")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-door-number">Door number</Label>
              <Input
                id="bp-door-number"
                {...register("address.doorNumber")}
                autoComplete="address-line3"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Label htmlFor="bp-complement">Complement</Label>
              <Input
                id="bp-complement"
                placeholder="Floor, wing, unit details…"
                {...register("address.complement")}
              />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1">
          <h3 className="text-sm font-semibold text-neutral-800">
            Location preview
          </h3>
          <BusinessAddressLocationMap addressQuery={addressQuery} />
        </div>
      </div>
    </section>
  );
}
