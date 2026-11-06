import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  deleteUserPhoto,
  getUserProfile,
  updateUserProfile,
} from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import type { ServiceRequestError } from "@/services/serviceErrors";
import type { UserProfile } from "@/auth/types";
import { useErrorMessage } from "@/i18n/errorCopy";
import { genderEnums } from "restaurant-pos-packages/enums";
import { UserAvatar } from "@/components/UserAvatar";
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
import { formatCalendarDate, isValidCalendarDate } from "@/lib/calendarDate";

const NO_VALUE = "__none__";

type ProfileForm = {
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  birthDate: string;
  gender: string;
  nationality: string;
};

const EMPTY_FORM: ProfileForm = {
  username: "",
  firstName: "",
  lastName: "",
  phoneNumber: "",
  birthDate: "",
  gender: "",
  nationality: "",
};

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
  return {
    username: personal.username ?? "",
    firstName: personal.firstName ?? "",
    lastName: personal.lastName ?? "",
    phoneNumber: personal.phoneNumber ?? "",
    birthDate: dateInputValue(personal.birthDate),
    gender: personal.gender ?? "",
    nationality: personal.nationality ?? "",
  };
}

/** `/account/profile` — self-service customer profile. */
export default function CustomerProfilePage() {
  const { t } = useTranslation("customer");
  const resolveError = useErrorMessage();
  const { state, dispatch } = useAuth();

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
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [removePhotoFailure, setRemovePhotoFailure] =
    useState<ServiceRequestError | null>(null);

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

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    setSaveFailure(null);
    setSaveMessage(null);

    const data = new FormData();
    data.append("username", form.username);
    data.append("firstName", form.firstName);
    data.append("lastName", form.lastName);
    data.append("phoneNumber", form.phoneNumber);
    data.append("birthDate", form.birthDate);
    data.append("gender", form.gender);
    data.append("nationality", form.nationality);

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
    if (updated && sessionUser) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: {
          ...sessionUser,
          imageUrl:
            updated.personalDetails.imageUrl ?? sessionUser.imageUrl,
          firstName:
            updated.personalDetails.firstName ?? sessionUser.firstName,
          lastName:
            updated.personalDetails.lastName ?? sessionUser.lastName,
        },
      });
    }
    setSaveMessage(t("profile.saveSuccess"));
    toast.success(t("profile.saveSuccess"));
  }

  async function onRemovePhoto() {
    if (!userId) return;

    setRemovePhotoFailure(null);
    setSaveMessage(null);
    setRemovingPhoto(true);
    const result = await deleteUserPhoto(userId);
    setRemovingPhoto(false);

    if (!result.ok) {
      setRemovePhotoFailure(result.error);
      return;
    }

    setProfile(result.data?.user ?? null);
    setImageFile(null);
    setImagePreviewUrl(null);
    if (sessionUser) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: { ...sessionUser, imageUrl: undefined },
      });
    }
    setSaveMessage(t("profile.photo.removeSuccess"));
    toast.success(t("profile.photo.removeSuccess"));
  }

  const email = profile?.personalDetails.email ?? sessionUser?.email ?? "";
  const storedImageUrl =
    profile?.personalDetails.imageUrl ?? sessionUser?.imageUrl ?? null;
  const imageUrl = imagePreviewUrl ?? storedImageUrl;
  const avatarName =
    [form.firstName, form.lastName].filter(Boolean).join(" ") || email;

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("profile.title")}
      </h1>

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
              <UserAvatar
                imageUrl={imageUrl}
                fallback={avatarName}
                alt={t("profile.photo.alt")}
                className="size-24"
                fallbackClassName="text-2xl"
              />
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
                {storedImageUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={removingPhoto}
                    onClick={() => void onRemovePhoto()}
                  >
                    {removingPhoto
                      ? t("profile.photo.removing")
                      : t("profile.photo.remove")}
                  </Button>
                ) : null}
                {removePhotoFailure ? (
                  <p className="text-sm text-destructive" role="alert">
                    {resolveError(removePhotoFailure)}
                  </p>
                ) : null}
              </div>
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
    </main>
  );
}
