import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import type { ServiceRequestError } from "@/services/serviceErrors";
import type { UserProfile, UserProfileAddress } from "@/auth/types";
import { useErrorMessage } from "@/i18n/errorCopy";
import { addressSchema } from "restaurant-pos-packages/schemas/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type EditableAddressField = keyof Omit<
  UserProfileAddress,
  "additionalDetails" | "coordinates"
>;

type AddressForm = Record<EditableAddressField, string>;

const EMPTY_ADDRESS: AddressForm = {
  country: "",
  state: "",
  city: "",
  street: "",
  buildingNumber: "",
  doorNumber: "",
  complement: "",
  postCode: "",
  region: "",
};

function formFromProfile(profile: UserProfile): AddressForm {
  const address = profile.personalDetails.address;
  return {
    country: address?.country ?? "",
    state: address?.state ?? "",
    city: address?.city ?? "",
    street: address?.street ?? "",
    buildingNumber: address?.buildingNumber ?? "",
    doorNumber: address?.doorNumber ?? "",
    complement: address?.complement ?? "",
    postCode: address?.postCode ?? "",
    region: address?.region ?? "",
  };
}

function cleanAddress(
  address: AddressForm,
  stored: UserProfileAddress | null,
): UserProfileAddress {
  const cleaned: UserProfileAddress = {
    country: address.country.trim(),
    state: address.state.trim(),
    city: address.city.trim(),
    street: address.street.trim(),
    buildingNumber: address.buildingNumber.trim(),
    postCode: address.postCode.trim(),
  };
  if (address.doorNumber.trim()) cleaned.doorNumber = address.doorNumber.trim();
  if (address.complement.trim()) cleaned.complement = address.complement.trim();
  if (address.region.trim()) cleaned.region = address.region.trim();
  if (stored?.additionalDetails) {
    cleaned.additionalDetails = stored.additionalDetails;
  }
  if (stored?.coordinates) cleaned.coordinates = stored.coordinates;
  return cleaned;
}

function addressIsComplete(
  address: AddressForm,
  stored: UserProfileAddress | null,
): boolean {
  return addressSchema.safeParse(cleanAddress(address, stored)).success;
}

function addressHasAnyValue(address: AddressForm): boolean {
  return Object.values(address).some((value) => value.trim() !== "");
}

/** `/account/address` — self-service customer address. */
export default function CustomerAddressPage() {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const { state } = useAuth();

  const sessionUser =
    state.status === "authenticated" && state.user?.type === "user"
      ? state.user
      : null;
  const userId = sessionUser?.id;

  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [storedAddress, setStoredAddress] =
    useState<UserProfileAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailure, setLoadFailure] = useState<ServiceRequestError | null>(
    null,
  );
  const [saveFailure, setSaveFailure] = useState<ServiceRequestError | null>(
    null,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void getUserProfile(userId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadFailure(result.error);
        return;
      }
      const loaded = result.data ?? null;
      setStoredAddress(loaded?.personalDetails.address ?? null);
      setForm(loaded ? formFromProfile(loaded) : EMPTY_ADDRESS);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function setAddressField(key: keyof AddressForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    setSaveFailure(null);
    setValidationMessage(null);
    setSaveMessage(null);

    const hasAddressValue = addressHasAnyValue(form);
    if (hasAddressValue && !addressIsComplete(form, storedAddress)) {
      setValidationMessage(t("address.errors.incomplete"));
      return;
    }

    const data = new FormData();
    data.append(
      "address",
      hasAddressValue
        ? JSON.stringify(cleanAddress(form, storedAddress))
        : "",
    );

    setSaving(true);
    const result = await updateUserProfile(userId, data);
    setSaving(false);

    if (!result.ok) {
      setSaveFailure(result.error);
      return;
    }

    const updated = result.data?.user ?? null;
    if (updated) {
      setStoredAddress(updated.personalDetails.address ?? null);
      setForm(formFromProfile(updated));
    } else {
      setStoredAddress(hasAddressValue ? storedAddress : null);
    }

    const successMessage = hasAddressValue
      ? t("address.saveSuccess")
      : t("address.clearSuccess");
    setSaveMessage(successMessage);
    toast.success(successMessage);
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("address.title")}
      </h1>

      {loadFailure ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {resolveError(loadFailure)}
        </p>
      ) : loading && userId ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <form className="mt-6 max-w-2xl space-y-6" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address-country">{t("address.fields.country")}</Label>
              <Input
                id="address-country"
                value={form.country}
                onChange={(e) => setAddressField("country", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-state">{t("address.fields.state")}</Label>
              <Input
                id="address-state"
                value={form.state}
                onChange={(e) => setAddressField("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-city">{t("address.fields.city")}</Label>
              <Input
                id="address-city"
                value={form.city}
                onChange={(e) => setAddressField("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-street">{t("address.fields.street")}</Label>
              <Input
                id="address-street"
                value={form.street}
                onChange={(e) => setAddressField("street", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-building">
                {t("address.fields.buildingNumber")}
              </Label>
              <Input
                id="address-building"
                value={form.buildingNumber}
                onChange={(e) =>
                  setAddressField("buildingNumber", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-door">
                {t("address.fields.doorNumber")}
              </Label>
              <Input
                id="address-door"
                value={form.doorNumber}
                onChange={(e) => setAddressField("doorNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-complement">
                {t("address.fields.complement")}
              </Label>
              <Input
                id="address-complement"
                value={form.complement}
                onChange={(e) => setAddressField("complement", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-post-code">
                {t("address.fields.postCode")}
              </Label>
              <Input
                id="address-post-code"
                value={form.postCode}
                onChange={(e) => setAddressField("postCode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-region">{t("address.fields.region")}</Label>
              <Input
                id="address-region"
                value={form.region}
                onChange={(e) => setAddressField("region", e.target.value)}
              />
            </div>
          </div>

          {validationMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {validationMessage}
            </p>
          ) : null}
          {saveFailure ? (
            <p className="text-sm text-destructive" role="alert">
              {resolveError(saveFailure)}
            </p>
          ) : null}
          {saveMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {saveMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={saving}>
            {saving ? t("address.actions.saving") : t("address.actions.save")}
          </Button>
        </form>
      )}
    </main>
  );
}
