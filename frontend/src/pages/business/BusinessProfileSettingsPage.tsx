import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Camera } from "lucide-react";
import { toast } from "sonner";
import { logout, setAccessToken } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  businessDtoToFormValues,
  formValuesToUpdatePayload,
  type BusinessProfileFormValues,
  useBusinessProfileQuery,
  useUpdateBusinessProfileMutation,
} from "@/services/businessService";
import { subscriptionEnums } from "@packages/enums.ts";

const EMPTY_PROFILE_FORM_VALUES: BusinessProfileFormValues = {
  subscription: "",
  imageUrl: "",
  imageFile: null,
  tradeName: "",
  legalName: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  taxNumber: "",
  currencyTrade: "",
  address: {
    country: "",
    state: "",
    city: "",
    street: "",
    buildingNumber: "",
    postCode: "",
    region: "",
  },
  contactPerson: "",
  cuisineType: "",
  categories: [],
  acceptsDelivery: false,
  deliveryRadius: null,
  minOrder: null,
  metrics: {
    foodCostPercentage: 30,
    beverageCostPercentage: 20,
    laborCostPercentage: 30,
    fixedCostPercentage: 20,
    supplierGoodWastePercentage: {
      veryLowBudgetImpact: 9,
      lowBudgetImpact: 7,
      mediumBudgetImpact: 5,
      hightBudgetImpact: 3,
      veryHightBudgetImpact: 1,
    },
  },
  businessOpeningHours: [],
  deliveryOpeningWindows: [],
  reportingConfig: {
    weeklyReportStartDay: null,
  },
};

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type DeliveryWindowsRowProps = {
  control: Control<BusinessProfileFormValues>;
  dayIndex: number;
  onRemoveDay: () => void;
};

function DeliveryWindowsRow({
  control,
  dayIndex,
  onRemoveDay,
}: DeliveryWindowsRowProps) {
  const windowsFieldArray = useFieldArray({
    control,
    name: `deliveryOpeningWindows.${dayIndex}.windows` as const,
  });

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemoveDay}>
          Remove day
        </Button>
      </div>
      {windowsFieldArray.fields.length === 0 ? (
        <p className="text-sm text-neutral-500">No windows configured yet for this day.</p>
      ) : null}
      {windowsFieldArray.fields.map((windowField, windowIndex) => (
        <div key={windowField.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor={`bp-delivery-open-${dayIndex}-${windowIndex}`}>
              Delivery open
            </Label>
            <Controller
              control={control}
              name={`deliveryOpeningWindows.${dayIndex}.windows.${windowIndex}.openTime`}
              render={({ field }) => (
                <Input
                  id={`bp-delivery-open-${dayIndex}-${windowIndex}`}
                  type="time"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bp-delivery-close-${dayIndex}-${windowIndex}`}>
              Delivery close
            </Label>
            <Controller
              control={control}
              name={`deliveryOpeningWindows.${dayIndex}.windows.${windowIndex}.closeTime`}
              render={({ field }) => (
                <Input
                  id={`bp-delivery-close-${dayIndex}-${windowIndex}`}
                  type="time"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => windowsFieldArray.remove(windowIndex)}
            >
              Remove window
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => windowsFieldArray.append({ openTime: "09:00", closeTime: "17:00" })}
      >
        Add delivery window
      </Button>
    </div>
  );
}

/** Phase 3.1 scaffold for `/business/:businessId/settings/profile` with query -> RHF hydration. */
export default function BusinessProfileSettingsPage() {
  const { t } = useTranslation("business");
  const navigate = useNavigate();
  const { businessId } = useParams<{ businessId: string }>();
  const { state, dispatch } = useAuth();
  const session = state.user;
  const canLoadProfile = Boolean(
    businessId && session && session.type === "business",
  );
  const profileQuery = useBusinessProfileQuery(
    canLoadProfile ? businessId : undefined,
    canLoadProfile,
  );
  const updateMutation = useUpdateBusinessProfileMutation();
  const [isCredentialsExpanded, setIsCredentialsExpanded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [navigationBypassAfterSave, setNavigationBypassAfterSave] = useState(false);
  const {
    register,
    reset,
    setValue,
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<BusinessProfileFormValues>({
    defaultValues: EMPTY_PROFILE_FORM_VALUES,
  });
  const unsavedChangesGuard = useUnsavedChangesGuard({
    isDirty,
    isSubmitting: updateMutation.isPending,
    enabled: !navigationBypassAfterSave,
  });
  const openingHoursFieldArray = useFieldArray({
    control,
    name: "businessOpeningHours",
  });
  const deliveryWindowsFieldArray = useFieldArray({
    control,
    name: "deliveryOpeningWindows",
  });
  const selectedSubscription = useWatch({ control, name: "subscription" });
  const categories = useWatch({ control, name: "categories" }) ?? [];
  const imageUrl = useWatch({ control, name: "imageUrl" });
  const imageFile = useWatch({ control, name: "imageFile" });
  const imagePreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  // Keep form defaults aligned with fresh query data without creating a secondary state layer.
  useEffect(() => {
    if (!profileQuery.data) return;
    reset(businessDtoToFormValues(profileQuery.data));
  }, [profileQuery.data, reset]);

  // Revoke browser object URL whenever preview source changes to prevent blob URL leaks.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  if (!session || session.type !== "business") {
    return null;
  }

  if (!businessId) {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
        <Alert>{t("profile.invalidRoute", { defaultValue: "Business route is invalid." })}</Alert>
      </main>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>
              {t("profile.loadingTitle", { defaultValue: "Loading business profile..." })}
            </CardTitle>
            <CardDescription>
              {t("profile.loadingDescription", {
                defaultValue: "Fetching the latest business data before rendering the form.",
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (profileQuery.isError) {
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : t("profile.loadError", { defaultValue: "Failed to load business profile." });
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>{t("profile.errorTitle", { defaultValue: "Could not load profile" })}</CardTitle>
            <CardDescription>
              {t("profile.errorDescription", {
                defaultValue: "Review the error and retry profile fetch.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>{message}</Alert>
            <Button
              type="button"
              variant="outline"
              onClick={() => void profileQuery.refetch()}
            >
              {t("profile.retry", { defaultValue: "Retry" })}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!profileQuery.data) {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
        <Alert>
          {t("profile.noData", {
            defaultValue: "No profile data was returned. Please retry.",
          })}
        </Alert>
      </main>
    );
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setValue("imageFile", file, { shouldDirty: true });
  };

  const shouldForceLogoutAfterSave = (values: BusinessProfileFormValues) => {
    const emailChanged = values.email.trim() !== session.email.trim();
    const passwordChanged = values.password.trim().length > 0;
    return emailChanged || passwordChanged;
  };

  const handleForcedLogout = async () => {
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
    navigate("/login", { replace: true });
  };

  const onSubmit = async (values: BusinessProfileFormValues) => {
    if (!businessId) return;
    setSubmitError(null);
    const forceLogoutAfterSave = shouldForceLogoutAfterSave(values);
    const payload = formValuesToUpdatePayload(values);

    try {
      await updateMutation.mutateAsync({
        businessId,
        formData: payload,
      });

      // Re-fetch after successful save so local baseline reflects canonical server values
      // (including cloud image URL after upload and any backend-side normalization).
      const refreshed = await profileQuery.refetch();
      if (refreshed.data) {
        reset(businessDtoToFormValues(refreshed.data), {
          keepDirty: false,
          keepTouched: false,
        });
      } else {
        reset({
          ...values,
          imageFile: null,
          password: "",
          confirmPassword: "",
          confirmEmail: values.email.trim(),
        }, {
          keepDirty: false,
          keepTouched: false,
        });
      }

      if (forceLogoutAfterSave) {
        toast.success(
          "Profile saved. Please sign in again to continue with updated credentials.",
        );
        await handleForcedLogout();
        return;
      }

      setNavigationBypassAfterSave(true);
      toast.success("Business profile saved successfully.");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to save business profile changes.",
      );
      toast.error("Failed to save business profile.");
    }
  };

  const handleResetToLastSaved = () => {
    if (!profileQuery.data) return;
    setSubmitError(null);
    reset(businessDtoToFormValues(profileQuery.data));
  };

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("profile.title")}</h1>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>
            {t("profile.formScaffoldTitle", { defaultValue: "Business profile form" })}
          </CardTitle>
          <CardDescription>
            {t("profile.formScaffoldDescription", {
              defaultValue:
                "Initial scaffold wired with API defaults. Full sections and save flow are implemented in upcoming phase tasks.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-8"
            aria-busy={updateMutation.isPending ? "true" : "false"}
            onChangeCapture={() => {
              if (navigationBypassAfterSave) setNavigationBypassAfterSave(false);
            }}
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          >
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Subscription
              </h2>
              <div role="radiogroup" aria-label="Subscription plan" className="grid gap-3 sm:grid-cols-3">
                {subscriptionEnums.map((plan) => {
                  const isSelected = selectedSubscription === plan;
                  return (
                    <button
                      key={plan}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select ${plan} plan`}
                      className={`rounded-lg border p-4 text-left transition ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500"
                      }`}
                      onClick={() =>
                        setValue("subscription", plan, { shouldDirty: true })
                      }
                    >
                      <p className="font-semibold">{plan}</p>
                      <p
                        className={`mt-1 text-xs ${
                          isSelected ? "text-neutral-200" : "text-neutral-500"
                        }`}
                      >
                        Selected plan for this business.
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Logo
              </h2>
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
                    onChange={handleImageUpload}
                  />
                  <p className="text-xs text-neutral-500">
                    {imageFile
                      ? `Selected file: ${imageFile.name}`
                      : imageUrl
                        ? "Current logo comes from the last saved cloud image URL."
                        : "Hover the avatar and upload a logo file."}
                  </p>
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
                Address
              </h2>
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

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Discovery and delivery
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
                <div className="space-y-2">
                  <Label htmlFor="bp-accepts-delivery">Accepts delivery</Label>
                  <Controller
                    control={control}
                    name="acceptsDelivery"
                    render={({ field }) => (
                      <select
                        id="bp-accepts-delivery"
                        className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                        value={field.value ? "yes" : "no"}
                        onChange={(event) => field.onChange(event.target.value === "yes")}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-delivery-radius">Delivery radius</Label>
                  <Input
                    id="bp-delivery-radius"
                    type="number"
                    step="0.01"
                    {...register("deliveryRadius", {
                      setValueAs: (value) =>
                        value === "" ? null : Number(value),
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-min-order">Minimum order</Label>
                  <Input
                    id="bp-min-order"
                    type="number"
                    step="0.01"
                    {...register("minOrder", {
                      setValueAs: (value) =>
                        value === "" ? null : Number(value),
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-weekly-start-day">Weekly report start day</Label>
                  <Controller
                    control={control}
                    name="reportingConfig.weeklyReportStartDay"
                    render={({ field }) => (
                      <select
                        id="bp-weekly-start-day"
                        className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                          )
                        }
                      >
                        <option value="">Not set</option>
                        {DAY_OPTIONS.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Metrics
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-food">Food cost percentage</Label>
                  <Input id="bp-metric-food" type="number" step="0.01" {...register("metrics.foodCostPercentage", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-beverage">Beverage cost percentage</Label>
                  <Input id="bp-metric-beverage" type="number" step="0.01" {...register("metrics.beverageCostPercentage", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-labor">Labor cost percentage</Label>
                  <Input id="bp-metric-labor" type="number" step="0.01" {...register("metrics.laborCostPercentage", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-fixed">Fixed cost percentage</Label>
                  <Input id="bp-metric-fixed" type="number" step="0.01" {...register("metrics.fixedCostPercentage", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-vlow">Waste very low impact</Label>
                  <Input id="bp-metric-vlow" type="number" step="0.01" {...register("metrics.supplierGoodWastePercentage.veryLowBudgetImpact", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-low">Waste low impact</Label>
                  <Input id="bp-metric-low" type="number" step="0.01" {...register("metrics.supplierGoodWastePercentage.lowBudgetImpact", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-medium">Waste medium impact</Label>
                  <Input id="bp-metric-medium" type="number" step="0.01" {...register("metrics.supplierGoodWastePercentage.mediumBudgetImpact", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-high">Waste high impact</Label>
                  <Input id="bp-metric-high" type="number" step="0.01" {...register("metrics.supplierGoodWastePercentage.hightBudgetImpact", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bp-metric-vhigh">Waste very high impact</Label>
                  <Input id="bp-metric-vhigh" type="number" step="0.01" {...register("metrics.supplierGoodWastePercentage.veryHightBudgetImpact", { valueAsNumber: true })} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Opening hours and delivery windows
              </h2>

              <div className="space-y-3 rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-800">Business opening hours</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openingHoursFieldArray.append({
                        dayOfWeek: 1,
                        openTime: "09:00",
                        closeTime: "17:00",
                      })
                    }
                  >
                    Add opening day
                  </Button>
                </div>
                {openingHoursFieldArray.fields.length === 0 ? (
                  <p className="text-sm text-neutral-500">No opening hours configured yet.</p>
                ) : null}
                {openingHoursFieldArray.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`bp-opening-day-${index}`}>Day</Label>
                      <Controller
                        control={control}
                        name={`businessOpeningHours.${index}.dayOfWeek`}
                        render={({ field: dayField }) => (
                          <select
                            id={`bp-opening-day-${index}`}
                            className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                            value={dayField.value}
                            onChange={(event) =>
                              dayField.onChange(Number(event.target.value))
                            }
                          >
                            {DAY_OPTIONS.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`bp-opening-open-${index}`}>Open</Label>
                      <Controller
                        control={control}
                        name={`businessOpeningHours.${index}.openTime`}
                        render={({ field: openField }) => (
                          <Input
                            id={`bp-opening-open-${index}`}
                            type="time"
                            value={openField.value}
                            onChange={openField.onChange}
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`bp-opening-close-${index}`}>Close</Label>
                      <Controller
                        control={control}
                        name={`businessOpeningHours.${index}.closeTime`}
                        render={({ field: closeField }) => (
                          <Input
                            id={`bp-opening-close-${index}`}
                            type="time"
                            value={closeField.value}
                            onChange={closeField.onChange}
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openingHoursFieldArray.remove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-800">Delivery opening windows</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      deliveryWindowsFieldArray.append({
                        dayOfWeek: 1,
                        windows: [{ openTime: "09:00", closeTime: "17:00" }],
                      })
                    }
                  >
                    Add delivery day
                  </Button>
                </div>
                {deliveryWindowsFieldArray.fields.length === 0 ? (
                  <p className="text-sm text-neutral-500">No delivery windows configured yet.</p>
                ) : null}
                {deliveryWindowsFieldArray.fields.map((field, dayIndex) => (
                  <div key={field.id} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`bp-delivery-day-${dayIndex}`}>Day</Label>
                      <Controller
                        control={control}
                        name={`deliveryOpeningWindows.${dayIndex}.dayOfWeek`}
                        render={({ field: dayField }) => (
                          <select
                            id={`bp-delivery-day-${dayIndex}`}
                            className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm sm:max-w-xs"
                            value={dayField.value}
                            onChange={(event) =>
                              dayField.onChange(Number(event.target.value))
                            }
                          >
                            {DAY_OPTIONS.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>
                    <DeliveryWindowsRow
                      control={control}
                      dayIndex={dayIndex}
                      onRemoveDay={() => deliveryWindowsFieldArray.remove(dayIndex)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                  Credentials
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCredentialsExpanded((current) => !current)}
                >
                  {isCredentialsExpanded
                    ? "Hide credentials"
                    : "Update credentials"}
                </Button>
              </div>
              {isCredentialsExpanded ? (
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

            {submitError ? <Alert>{submitError}</Alert> : null}

            <section className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending || !isDirty}
                onClick={handleResetToLastSaved}
              >
                Reset changes
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </section>
          </form>
        </CardContent>
      </Card>
      <UnsavedChangesDialog
        open={unsavedChangesGuard.isDialogOpen}
        onStay={unsavedChangesGuard.stayOnPage}
        onLeave={unsavedChangesGuard.leavePage}
        isLeaving={unsavedChangesGuard.isLeaving}
      />
    </main>
  );
}
