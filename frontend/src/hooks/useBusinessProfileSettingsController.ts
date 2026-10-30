import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormHandleSubmit,
  type UseFormRegister,
  type UseFormReset,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/store/AuthContext";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useQuery } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import {
  businessDtoToFormValues,
  fetchManagementContactOptions,
  formValuesToUpdatePayload,
  type BusinessProfileDto,
  type BusinessProfileFormValues,
  type ManagementContactOption,
  type UpdateBusinessProfileSuccess,
  useBusinessProfileQuery,
  useUpdateBusinessProfileMutation,
} from "@/services/business/businessService";
import { queryKeys } from "@/services/queryKeys";
import { toServiceRequestError } from "@/services/serviceErrors";
import { buildBusinessProfileSchema } from "@/services/business/businessProfileFormSchema";

/** RHF defaults for business profile PATCH; must stay aligned with `businessDtoToFormValues` shape. */
const EMPTY_PROFILE_FORM_VALUES: BusinessProfileFormValues = {
  subscription: "",
  imageUrl: "",
  imageFile: null,
  tradeName: "",
  phoneNumber: "",
  currencyTrade: "",
  address: {
    country: "",
    state: "",
    city: "",
    street: "",
    buildingNumber: "",
    doorNumber: "",
    complement: "",
    postCode: "",
    region: "",
  },
  contactPerson: "",
  cuisineType: [],
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

/**
 * Weekday options for opening hours / delivery / reporting selects.
 * Values stay numeric and stable; labels are translated at render time.
 */
export const DAY_OPTIONS = [
  { value: 0, labelKey: "weekdays.sunday" },
  { value: 1, labelKey: "weekdays.monday" },
  { value: 2, labelKey: "weekdays.tuesday" },
  { value: 3, labelKey: "weekdays.wednesday" },
  { value: 4, labelKey: "weekdays.thursday" },
  { value: 5, labelKey: "weekdays.friday" },
  { value: 6, labelKey: "weekdays.saturday" },
] as const;

/** Profile loaded; same React Query cache key as {@link useBusinessProfileSettingsController}. */
export type BusinessProfileSettingsGateReady = {
  kind: "ready";
  businessId: string;
  profile: BusinessProfileDto;
  profileQuery: UseQueryResult<BusinessProfileDto, Error>;
};

export type BusinessProfileSettingsGateResult =
  | { kind: "wrong-session" }
  | { kind: "no-business-id" }
  | { kind: "loading" }
  | { kind: "error"; failure?: ErrorFailure; refetch: () => Promise<unknown> }
  | { kind: "no-data" }
  | BusinessProfileSettingsGateReady;

/** Non-ready states returned before the full RHF + mutation controller is built. */
export type BusinessProfileSettingsPageBlocked = Exclude<
  BusinessProfileSettingsGateResult,
  BusinessProfileSettingsGateReady
>;

/**
 * Session + route + **`useBusinessProfileQuery`** only (no RHF, no PATCH).
 * Used by **`BusinessProfileSettingsStaticShell`** and internally by {@link useBusinessProfileSettingsController}.
 */
export function useBusinessProfileSettingsGate(): BusinessProfileSettingsGateResult {
  const { businessId } = useParams<{ businessId: string }>();
  const { state } = useAuth();
  const session = state.user;

  const canLoadProfile = Boolean(businessId && session);
  const profileQuery = useBusinessProfileQuery(
    canLoadProfile ? businessId : undefined,
    canLoadProfile,
  );

  if (!session) {
    return { kind: "wrong-session" };
  }

  if (!businessId) {
    return { kind: "no-business-id" };
  }

  const {
    data: profileData,
    isError: profileIsError,
    isLoading: profileIsLoading,
    isPending: profileIsPending,
    isFetching: profileIsFetching,
  } = profileQuery;

  const isAwaitingProfileData =
    !profileData &&
    !profileIsError &&
    (profileIsLoading || profileIsPending || profileIsFetching);

  if (isAwaitingProfileData) {
    return { kind: "loading" };
  }

  if (profileQuery.isError) {
    return {
      kind: "error",
      failure: profileQuery.error
        ? toServiceRequestError(profileQuery.error, "businessFetch")
        : undefined,
      refetch: () => profileQuery.refetch(),
    };
  }

  if (!profileQuery.data) {
    return { kind: "no-data" };
  }

  return {
    kind: "ready",
    businessId,
    profile: profileQuery.data,
    profileQuery,
  };
}

export type BusinessProfileSettingsReady = {
  kind: "ready";
  businessId: string;
  profileQuery: UseQueryResult<BusinessProfileDto, Error>;
  register: UseFormRegister<BusinessProfileFormValues>;
  control: Control<BusinessProfileFormValues>;
  setValue: UseFormSetValue<BusinessProfileFormValues>;
  handleSubmit: UseFormHandleSubmit<BusinessProfileFormValues>;
  reset: UseFormReset<BusinessProfileFormValues>;
  isDirty: boolean;
  errors: FieldErrors<BusinessProfileFormValues>;
  isSubmitted: boolean;
  isValid: boolean;
  updateMutation: UseMutationResult<
    UpdateBusinessProfileSuccess,
    Error,
    { businessId: string; formData: FormData }
  >;
  submitError: ErrorFailure | null;
  setSubmitError: (value: ErrorFailure | null) => void;
  onSubmit: (values: BusinessProfileFormValues) => Promise<void>;
  handleResetToLastSaved: () => void;
  handleImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  imagePreviewUrl: string | null;
  imageUrl: string;
  imageFile: File | null;
  managementContactRows: ManagementContactOption[];
  unsavedChangesGuard: ReturnType<typeof useUnsavedChangesGuard>;
  navigationBypassAfterSave: boolean;
  onFormChangeCapture: () => void;
};

export type BusinessProfileSettingsController =
  | BusinessProfileSettingsPageBlocked
  | BusinessProfileSettingsReady;

/**
 * Shared business profile form controller for split settings routes.
 * Each route keeps the full `BusinessProfileFormValues` so `formValuesToUpdatePayload` stays correct on save.
 */
export function useBusinessProfileSettingsController(): BusinessProfileSettingsController {
  const gate = useBusinessProfileSettingsGate();
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const [submitError, setSubmitError] = useState<ErrorFailure | null>(null);
  const [navigationBypassAfterSave, setNavigationBypassAfterSave] = useState(false);

  const profileSchema = useMemo(
    () =>
      buildBusinessProfileSchema({
        required: t("profileForm.validation.required"),
        invalidSubscription: t("profileForm.validation.invalidSubscription"),
        invalidCurrency: t("profileForm.validation.invalidCurrency"),
        invalidTime: t("profileForm.validation.invalidTime"),
        invalidDayOfWeek: t("profileForm.validation.invalidDayOfWeek"),
        invalidNonNegative: t("profileForm.validation.invalidNonNegative"),
        invalidWeeklyStartDay: t("profileForm.validation.invalidWeeklyStartDay"),
        invalidImage: t("profileForm.validation.invalidImage"),
        openingRange: t("profileForm.validation.openingRange"),
        deliveryRange: t("profileForm.validation.deliveryRange"),
      }),
    [t],
  );

  const updateMutation = useUpdateBusinessProfileMutation();
  const contactsBusinessId =
    gate.kind === "ready" ? gate.businessId : null;
  const managementContactsQuery = useQuery({
    queryKey: contactsBusinessId
      ? queryKeys.employees.managementContacts(contactsBusinessId)
      : ["employees", "managementContacts", "pending"],
    queryFn: ({ signal }) =>
      fetchManagementContactOptions(contactsBusinessId ?? "", signal),
    enabled: Boolean(contactsBusinessId),
    // Keep stable shape while loading so select rendering doesn't thrash.
    initialData: [] as ManagementContactOption[],
  });

  const readyProfile = gate.kind === "ready" ? gate.profile : undefined;
  const profileFormValues = useMemo(
    () =>
      readyProfile ? businessDtoToFormValues(readyProfile) : undefined,
    [readyProfile],
  );

  const {
    register,
    reset,
    setValue,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitted, isValid },
  } = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(profileSchema),
    // RHF uses `defaultValues` for the initial snapshot (`defaultValues || values`); keep it aligned with the
    // loaded profile so Radix Select never mounts with `currencyTrade: ""` and flips `isDirty` before `values` syncs.
    defaultValues: profileFormValues ?? EMPTY_PROFILE_FORM_VALUES,
    ...(profileFormValues ? { values: profileFormValues } : {}),
  });

  const unsavedChangesGuard = useUnsavedChangesGuard({
    isDirty,
    isSubmitting: updateMutation.isPending,
    enabled: !navigationBypassAfterSave,
  });

  const imageUrl = useWatch({ control, name: "imageUrl" });
  const imageFile = useWatch({ control, name: "imageFile" });
  const contactPersonValue = useWatch({ control, name: "contactPerson" }) ?? "";
  const imagePreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );
  const managementContactRows = useMemo(() => {
    const rows = [...(managementContactsQuery.data ?? [])];
    const ids = new Set(rows.map((row) => row.employeeId));
    if (contactPersonValue && !ids.has(contactPersonValue)) {
      rows.unshift({
        employeeId: contactPersonValue,
        displayName: contactPersonValue,
      });
    }
    return rows;
  }, [managementContactsQuery.data, contactPersonValue]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  if (gate.kind !== "ready") {
    return gate;
  }

  const { businessId, profileQuery } = gate;

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setValue("imageFile", file, { shouldDirty: true });
  };

  const onSubmit = async (values: BusinessProfileFormValues) => {
    setSubmitError(null);
    const payload = formValuesToUpdatePayload(values);

    try {
      await updateMutation.mutateAsync({
        businessId,
        formData: payload,
      });

      const refreshed = await profileQuery.refetch();
      if (refreshed.data) {
        reset(businessDtoToFormValues(refreshed.data), {
          keepDirty: false,
          keepTouched: false,
        });
      } else {
        reset(
          {
            ...values,
            imageFile: null,
          },
          {
            keepDirty: false,
            keepTouched: false,
          },
        );
      }

      setNavigationBypassAfterSave(true);
      toast.success(t("profile.saveSuccess"));
    } catch (error) {
      const failure = toServiceRequestError(error, "businessUpdate");
      setSubmitError(failure);
      toast.error(resolveError(failure));
    }
  };

  const handleResetToLastSaved = () => {
    if (!profileQuery.data) return;
    setSubmitError(null);
    reset(businessDtoToFormValues(profileQuery.data));
  };

  const onFormChangeCapture = () => {
    if (navigationBypassAfterSave) setNavigationBypassAfterSave(false);
  };

  return {
    kind: "ready",
    businessId,
    profileQuery,
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    isDirty,
    errors,
    isSubmitted,
    isValid,
    updateMutation,
    submitError,
    setSubmitError,
    onSubmit,
    handleResetToLastSaved,
    handleImageUpload,
    imagePreviewUrl,
    imageUrl,
    imageFile: imageFile ?? null,
    managementContactRows,
    unsavedChangesGuard,
    navigationBypassAfterSave,
    onFormChangeCapture,
  };
}
