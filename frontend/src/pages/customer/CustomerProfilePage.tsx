import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import type { ServiceRequestError } from "@/services/serviceErrors";
import type { UserProfile, UserProfileAddress } from "@/auth/types";
import { useErrorMessage } from "@/i18n/errorCopy";
import { genderEnums } from "restaurant-pos-packages/enums";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResendEmailConfirmation } from "@/hooks/useResendEmailConfirmation";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { changeAppLanguage } from "@/i18n/i18n";
import { formatCalendarDate, isValidCalendarDate } from "@/lib/calendarDate";

const NO_VALUE = "__none__";

type AddressForm = {
  country: string;
  state: string;
  city: string;
  street: string;
  buildingNumber: string;
  doorNumber: string;
  complement: string;
  postCode: string;
  region: string;
};

type ProfileForm = {
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  birthDate: string;
  gender: string;
  nationality: string;
  languagePreference: string;
  address: AddressForm;
};

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

const EMPTY_FORM: ProfileForm = {
  username: "",
  firstName: "",
  lastName: "",
  phoneNumber: "",
  birthDate: "",
  gender: "",
  nationality: "",
  languagePreference: "",
  address: { ...EMPTY_ADDRESS },
};

const REQUIRED_ADDRESS_FIELDS: (keyof AddressForm)[] = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

function dateInputValue(value: string | Date | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const calendarDate = value.slice(0, 10);
    return isValidCalendarDate(calendarDate) ? calendarDate : "";
  }
  return formatCalendarDate(value);
}

function formFromProfile(profile: UserProfile): ProfileForm {
  const personal = profile.personalDetails;
  const address = personal.address;
  return {
    username: personal.username ?? "",
    firstName: personal.firstName ?? "",
    lastName: personal.lastName ?? "",
    phoneNumber: personal.phoneNumber ?? "",
    birthDate: dateInputValue(personal.birthDate),
    gender: personal.gender ?? "",
    nationality: personal.nationality ?? "",
    languagePreference: profile.languagePreference ?? "",
    address: {
      country: address?.country ?? "",
      state: address?.state ?? "",
      city: address?.city ?? "",
      street: address?.street ?? "",
      buildingNumber: address?.buildingNumber ?? "",
      doorNumber: address?.doorNumber ?? "",
      complement: address?.complement ?? "",
      postCode: address?.postCode ?? "",
      region: address?.region ?? "",
    },
  };
}

function cleanAddress(address: AddressForm): UserProfileAddress {
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
  return cleaned;
}

function addressIsComplete(address: AddressForm): boolean {
  return REQUIRED_ADDRESS_FIELDS.every((key) => address[key].trim() !== "");
}

function addressHasAnyValue(address: AddressForm): boolean {
  return Object.values(address).some((value) => value.trim() !== "");
}

/** `/profile` — self-service customer profile and language. */
export default function CustomerProfilePage() {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const { state, dispatch } = useAuth();
  const { resend, pending: resendPending } = useResendEmailConfirmation({
    successMessage: t("profile.emailVerify.resendSuccess"),
  });

  const sessionUser =
    state.status === "authenticated" && state.user?.type === "user"
      ? state.user
      : null;
  const userId = sessionUser?.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailure, setLoadFailure] = useState<ServiceRequestError | null>(
    null,
  );
  const [saveFailure, setSaveFailure] = useState<ServiceRequestError | null>(
    null,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changeEmailMessage, setChangeEmailMessage] = useState<string | null>(
    null,
  );
  const languageOptions = useLanguageOptions();

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
      setProfile(loaded);
      setForm(loaded ? formFromProfile(loaded) : EMPTY_FORM);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function setField<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setAddressField(key: keyof AddressForm, value: string) {
    setForm((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function onLanguageChange(value: string) {
    const next = value === NO_VALUE ? "" : value;
    setField("languagePreference", next);
    await changeAppLanguage(next || "en");

    if (!userId) return;

    const data = new FormData();
    data.append("languagePreference", next);
    const result = await updateUserProfile(userId, data);
    if (!result.ok) {
      setSaveFailure(result.error);
      return;
    }

    const updated = result.data?.user ?? null;
    if (updated) setProfile(updated);
    if (sessionUser && updated) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: {
          ...sessionUser,
          languagePreference: updated.languagePreference,
        },
      });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    setSaveFailure(null);
    setSaveMessage(null);

    const hasAddressValue = addressHasAnyValue(form.address);
    if (hasAddressValue && !addressIsComplete(form.address)) {
      setSaveMessage(t("profile.errors.addressIncomplete"));
      return;
    }

    const data = new FormData();
    data.append("username", form.username);
    data.append("firstName", form.firstName);
    data.append("lastName", form.lastName);
    data.append("phoneNumber", form.phoneNumber);
    data.append("birthDate", form.birthDate);
    data.append("gender", form.gender);
    data.append("nationality", form.nationality);
    data.append("languagePreference", form.languagePreference);

    if (hasAddressValue) {
      data.append("address", JSON.stringify(cleanAddress(form.address)));
    } else if (profile?.personalDetails.address) {
      data.append("address", "");
    }
    if (imageFile) data.append("imageUrl", imageFile);

    setSaving(true);
    const result = await updateUserProfile(userId, data);
    setSaving(false);

    if (!result.ok) {
      setSaveFailure(result.error);
      return;
    }

    const updated = result.data?.user ?? null;
    setProfile(updated);
    setImageFile(null);
    setImagePreviewUrl(null);
    setSaveMessage(t("profile.saveSuccess"));
    toast.success(t("profile.saveSuccess"));

    if (sessionUser && updated) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: {
          ...sessionUser,
          languagePreference: updated.languagePreference,
        },
      });
    }
  }

  const needsVerification =
    state.status === "authenticated" && sessionUser?.emailVerified === false;

  const imageUrl =
    imagePreviewUrl ?? profile?.personalDetails.imageUrl ?? null;
  const email = profile?.personalDetails.email ?? sessionUser?.email ?? "";

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("profile.title")}
      </h1>

      {needsVerification ? (
        <div
          className="mt-4 max-w-lg rounded-md border border-warning/40 bg-warning/20 px-3 py-3 text-sm text-foreground"
          role="status"
        >
          <p className="font-medium">{t("profile.emailVerify.bannerTitle")}</p>
          <p className="mt-1">
            {t("profile.emailVerify.bannerDescription")}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={resendPending}
            onClick={() => void resend()}
          >
            {resendPending
              ? t("profile.emailVerify.resendSending")
              : t("profile.emailVerify.resendButton")}
          </Button>
        </div>
      ) : null}

      {loadFailure ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {resolveError(loadFailure)}
        </p>
      ) : loading && userId ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <form className="mt-6 max-w-2xl space-y-8" onSubmit={onSubmit}>
          <section className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="size-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={t("profile.photo.alt")}
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-photo">
                  {t("profile.photo.label")}
                </Label>
                <Input
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                />
                <p className="text-xs text-muted-foreground">
                  {t("profile.photo.hint")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">
                {t("profile.fields.email")}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  readOnly
                  aria-describedby="profile-email-hint"
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangeEmailMessage(null);
                    setChangeEmailOpen(true);
                  }}
                >
                  {t("profile.changeEmail.action")}
                </Button>
              </div>
              <p
                id="profile-email-hint"
                className="text-xs text-muted-foreground"
              >
                {t("profile.fields.emailHint")}
              </p>
              {changeEmailMessage ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {changeEmailMessage}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              {t("profile.sections.personal")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-username">
                  {t("profile.fields.username")}
                </Label>
                <Input
                  id="profile-username"
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">
                  {t("profile.fields.phoneNumber")}
                </Label>
                <Input
                  id="profile-phone"
                  value={form.phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">
                  {t("profile.fields.firstName")}
                </Label>
                <Input
                  id="profile-first-name"
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last-name">
                  {t("profile.fields.lastName")}
                </Label>
                <Input
                  id="profile-last-name"
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-birth-date">
                  {t("profile.fields.birthDate")}
                </Label>
                <Input
                  id="profile-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-gender">
                  {t("profile.fields.gender")}
                </Label>
                <Select
                  value={form.gender || NO_VALUE}
                  onValueChange={(value) =>
                    setField("gender", value === NO_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger id="profile-gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>
                      {t("profile.fields.notSet")}
                    </SelectItem>
                    {genderEnums.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {t(`profile.genderOptions.${gender.toLowerCase()}`, gender)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-nationality">
                  {t("profile.fields.nationality")}
                </Label>
                <Input
                  id="profile-nationality"
                  value={form.nationality}
                  onChange={(e) => setField("nationality", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-language">
                  {t("profile.fields.language")}
                </Label>
                <Select
                  value={form.languagePreference || NO_VALUE}
                  onValueChange={(value) => void onLanguageChange(value)}
                >
                  <SelectTrigger id="profile-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>
                      {t("profile.fields.notSet")}
                    </SelectItem>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              {t("profile.sections.address")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-address-country">
                  {t("profile.address.country")}
                </Label>
                <Input
                  id="profile-address-country"
                  value={form.address.country}
                  onChange={(e) => setAddressField("country", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-state">
                  {t("profile.address.state")}
                </Label>
                <Input
                  id="profile-address-state"
                  value={form.address.state}
                  onChange={(e) => setAddressField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-city">
                  {t("profile.address.city")}
                </Label>
                <Input
                  id="profile-address-city"
                  value={form.address.city}
                  onChange={(e) => setAddressField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-street">
                  {t("profile.address.street")}
                </Label>
                <Input
                  id="profile-address-street"
                  value={form.address.street}
                  onChange={(e) => setAddressField("street", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-building">
                  {t("profile.address.buildingNumber")}
                </Label>
                <Input
                  id="profile-address-building"
                  value={form.address.buildingNumber}
                  onChange={(e) =>
                    setAddressField("buildingNumber", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-door">
                  {t("profile.address.doorNumber")}
                </Label>
                <Input
                  id="profile-address-door"
                  value={form.address.doorNumber}
                  onChange={(e) => setAddressField("doorNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-complement">
                  {t("profile.address.complement")}
                </Label>
                <Input
                  id="profile-address-complement"
                  value={form.address.complement}
                  onChange={(e) =>
                    setAddressField("complement", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-post-code">
                  {t("profile.address.postCode")}
                </Label>
                <Input
                  id="profile-address-post-code"
                  value={form.address.postCode}
                  onChange={(e) => setAddressField("postCode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address-region">
                  {t("profile.address.region")}
                </Label>
                <Input
                  id="profile-address-region"
                  value={form.address.region}
                  onChange={(e) => setAddressField("region", e.target.value)}
                />
              </div>
            </div>
          </section>

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
            {saving ? t("profile.actions.saving") : t("profile.actions.save")}
          </Button>
        </form>
      )}

      <ChangeEmailDialog
        open={changeEmailOpen}
        currentEmail={email}
        hasGoogleIdentity={sessionUser?.hasGoogleIdentity === true}
        hasPassword={sessionUser?.hasPassword === true}
        onOpenChange={setChangeEmailOpen}
        onRequested={() => {
          const message = t("profile.changeEmail.success");
          setChangeEmailMessage(message);
          toast.success(message);
        }}
      />
    </main>
  );
}
