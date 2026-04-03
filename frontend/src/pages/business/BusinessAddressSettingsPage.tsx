import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusinessProfileSettingsFormShell } from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

/** Street address and region fields for the business profile. */
export default function BusinessAddressSettingsPage() {
  const { t: tNav } = useTranslation("nav");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.address")}
      cardDescription="Postal and location details used on records and discovery."
    >
      {(ctx) => <AddressSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function AddressSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { register } = ctx;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">Address</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bp-country">Country</Label>
          <Input id="bp-country" {...register("address.country")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-state">State</Label>
          <Input id="bp-state" {...register("address.state")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-city">City</Label>
          <Input id="bp-city" {...register("address.city")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-post-code">Post code</Label>
          <Input id="bp-post-code" {...register("address.postCode")} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bp-street">Street</Label>
          <Input id="bp-street" {...register("address.street")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-building-number">Building number</Label>
          <Input id="bp-building-number" {...register("address.buildingNumber")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-region">Region</Label>
          <Input id="bp-region" {...register("address.region")} />
        </div>
      </div>
    </section>
  );
}
