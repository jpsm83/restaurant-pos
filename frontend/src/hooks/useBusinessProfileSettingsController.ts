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
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { logout, setAccessToken } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
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
import { buildBusinessProfileSchema } from "@/services/business/businessProfileFormSchema";

/** RHF defaults for business profile PATCH; must stay aligned with `businessDtoToFormValues` shape. */
const EMPTY_PROFILE_FORM_VALUES: BusinessProfileFormValues = {
  subscription: "",
  imageUrl: "",
  imageFile: null,
  tradeName: "",
  legalName: "",
  email: "",
  confirmEmail: "",
  currentPassword: "",
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

/** Weekday labels for opening hours / delivery / reporting selects (shared across settings pages). */
export const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export type BusinessProfileSettingsBlockedKind =
  | "wrong-session"
  | "no-business-id"
  | "loading"
  | "error"
  | "no-data";

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
  submitError: string | null;
  setSubmitError: (value: string | null) => void;
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
  | {
      kind: Exclude<BusinessProfileSettingsBlockedKind, "error">;
      message?: string;
    }
  | { kind: "error"; message?: string; refetch: () => Promise<unknown> }
  | BusinessProfileSettingsReady;

/**
 * Shared business profile form controller for split settings routes.
 * Each route keeps the full `BusinessProfileFormValues` so `formValuesToUpdatePayload` stays correct on save.
 */
export function useBusinessProfileSettingsController(): BusinessProfileSettingsController {
  const navigate = useNavigate();
  const { businessId } = useParams<{ businessId: string }>();
  const { state, dispatch } = useAuth();
  const session = state.user;
  const { t } = useTranslation("business");
  const { t: tAuth } = useTranslation("auth");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [navigationBypassAfterSave, setNavigationBypassAfterSave] = useState(false);

  const profileSchema = useMemo(
    () =>
      buildBusinessProfileSchema({
        required: t("profileForm.validation.required"),
        invalidEmail: t("profileForm.validation.invalidEmail"),
        emailMismatch: t("profileForm.validation.emailMismatch"),
        passwordMismatch: t("profileForm.validation.passwordMismatch"),
        passwordPolicy: tAuth("signup.errors.passwordPolicy"),
        currentPasswordRequired: t(
          "credentialsSettings.validation.currentPasswordRequired",
        ),
        invalidSubscription: t("profileForm.validation.invalidSubscription"),
        invalidCurrency: t("profileForm.validation.invalidCurrency"),
        invalidTime: t("profileForm.validation.invalidTime"),
        invalidDayOfWeek: t("profileForm.validation.invalidDayOfWeek"),
        invalidNonNegative: t("profileForm.validation.invalidNonNegative"),
        invalidWeeklyStartDay: t("profileForm.validation.invalidWeeklyStartDay"),
      }),
    [t, tAuth],
  );

  const canLoadProfile = Boolean(
    businessId && session && session.type === "business",
  );
  const profileQuery = useBusinessProfileQuery(
    canLoadProfile ? businessId : undefined,
    canLoadProfile,
  );
  const updateMutation = useUpdateBusinessProfileMutation();
  const managementContactsQuery = useQuery({
    queryKey: businessId
      ? queryKeys.employees.managementContacts(businessId)
      : ["employees", "managementContacts", "pending"],
    queryFn: ({ signal }) =>
      fetchManagementContactOptions(businessId ?? "", signal),
    enabled: Boolean(businessId && canLoadProfile),
    // Keep stable shape while loading so select rendering doesn't thrash.
    initialData: [] as ManagementContactOption[],
  });

  const profileFormValues = useMemo(
    () =>
      profileQuery.data
        ? businessDtoToFormValues(profileQuery.data)
        : undefined,
    [profileQuery.data],
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

  if (!session || session.type !== "business") {
    return { kind: "wrong-session" };
  }

  if (!businessId) {
    return { kind: "no-business-id" };
  }

  // No DTO yet: show skeleton while the first request is in flight (or pending). Include `isPending`/`isFetching`
  // alongside `isLoading` so we stay correct if one flag leads the other by a tick; tests may mock only `isLoading`.
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
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : undefined;
    return {
      kind: "error",
      message,
      refetch: () => profileQuery.refetch(),
    };
  }

  if (!profileQuery.data) {
    return { kind: "no-data" };
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
    setSubmitError(null);
    const forceLogoutAfterSave = shouldForceLogoutAfterSave(values);
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
            currentPassword: "",
            password: "",
            confirmPassword: "",
            confirmEmail: values.email.trim(),
          },
          {
            keepDirty: false,
            keepTouched: false,
          },
        );
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
