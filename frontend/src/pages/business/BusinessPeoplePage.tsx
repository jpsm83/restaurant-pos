import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useParams } from "react-router-dom";
import { Plus, ShieldAlert, Users } from "lucide-react";
import { employmentStatusEnums } from "restaurant-pos-packages/enums";
import {
  compareAccessLayers,
  getDefaultAccessLayerForJobRole,
  JOB_ROLE_DEFAULT_LAYERS,
} from "restaurant-pos-packages/access";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatting } from "@/hooks/useFormatting";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import { formatCalendarDate, isValidCalendarDate } from "@/lib/calendarDate";
import {
  canManageVenue,
  hireFailureReason,
  useBusinessAccessSnapshotQuery,
  useHireEmployeeMutation,
  useVenueMembershipsQuery,
  type BusinessAccessSnapshot,
  type HireFailureReason,
  type VenueMembership,
} from "@/services/employees/employeesService";
import { ServiceRequestError } from "@/services/serviceErrors";

const hireFormSchema = z.object({
  userEmail: z.string().trim().min(1),
  allEmployeeRoles: z.array(z.string()).min(1),
  employmentStatus: z.string().min(1),
  joinDate: z.string().refine(isValidCalendarDate),
});

type HireFormValues = z.infer<typeof hireFormSchema>;
type HireField = "userEmail" | "allEmployeeRoles" | "joinDate";

const HIRE_FIELD_ORDER: HireField[] = [
  "userEmail",
  "allEmployeeRoles",
  "joinDate",
];

const ROLE_LABEL_KEYS: Record<string, string> = {
  Owner: "owner",
  Admin: "admin",
  "General Manager": "generalManager",
  Manager: "manager",
  "Assistant Manager": "assistantManager",
  MoD: "mod",
  Supervisor: "supervisor",
  Operator: "operator",
  Employee: "employee",
  Cashier: "cashier",
  "Floor Staff": "floorStaff",
  Bartender: "bartender",
  Barista: "barista",
  Waiter: "waiter",
  "Head Chef": "headChef",
  "Sous Chef": "sousChef",
  "Line Cooks": "lineCooks",
  "Kitchen Porter": "kitchenPorter",
  Cleaner: "cleaner",
  Security: "security",
  Host: "host",
  Runner: "runner",
  Entertainer: "entertainer",
  Other: "other",
};

/** A new membership cannot start Terminated, so the hire form omits it. */
const HIRE_STATUS_OPTIONS = employmentStatusEnums.filter(
  (status) => status !== "Terminated",
);

const STATUS_LABEL_KEYS: Record<string, string> = {
  Active: "active",
  Seasonal: "seasonal",
  "Medical absence": "medicalAbsence",
  "Parental leave": "parentalLeave",
  "Unpaid leave": "unpaidLeave",
  Suspended: "suspended",
  Terminated: "terminated",
};

function roleOptionsFor(access: BusinessAccessSnapshot): string[] {
  return Object.keys(JOB_ROLE_DEFAULT_LAYERS).filter((role) => {
    if (access.source === "ownership") return true;
    return (
      compareAccessLayers(
        getDefaultAccessLayerForJobRole(role),
        access.effectiveLayer,
      ) < 0
    );
  });
}

function isForbiddenFailure(failure: ErrorFailure | null): boolean {
  return failure?.status === 403 || failure?.code.endsWith(".forbidden") === true;
}

/** API timestamps are ISO date-times; display the stored calendar day. */
function calendarDatePart(value: string): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? value;
}

function HireStaffForm({
  businessId,
  access,
  onHired,
  onCancel,
}: {
  businessId: string;
  access: BusinessAccessSnapshot;
  onHired: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("business");
  const resolveError = useErrorMessage();
  const hireMutation = useHireEmployeeMutation(businessId);
  const roleOptions = roleOptionsFor(access);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<HireFormValues>({
    resolver: zodResolver(hireFormSchema),
    defaultValues: {
      userEmail: "",
      allEmployeeRoles: [],
      employmentStatus: "Active",
      joinDate: formatCalendarDate(new Date()),
    },
  });

  const roles = useWatch({
    control,
    name: "allEmployeeRoles",
    defaultValue: [],
  });
  const status = useWatch({
    control,
    name: "employmentStatus",
    defaultValue: "Active",
  });
  const [failure, setFailure] = useState<ErrorFailure | null>(null);

  const toggleRole = (role: string, checked: boolean) => {
    setValue(
      "allEmployeeRoles",
      checked
        ? [...roles, role]
        : roles.filter((item) => item !== role),
      { shouldValidate: true },
    );
  };

  const hireMessage = (reason: HireFailureReason): string => {
    switch (reason) {
      case "accountNotFound":
        return t("people.errors.noAccount");
      case "alreadyMember":
        return t("people.errors.alreadyMember");
      case "forbidden":
        return t("people.errors.forbidden");
      case "validation":
        return t("people.errors.validation");
      default:
        return resolveError(failure ?? { code: "employeesCreate.transport" });
    }
  };

  const validationMessage = (field: HireField): string => {
    switch (field) {
      case "userEmail":
        return t("people.validation.emailRequired");
      case "allEmployeeRoles":
        return t("people.validation.rolesRequired");
      case "joinDate":
        return t("people.validation.joinDateRequired");
    }
  };

  const invalidField = HIRE_FIELD_ORDER.find((field) => Boolean(errors[field]));

  const onSubmit = async (values: HireFormValues) => {
    setFailure(null);
    try {
      await hireMutation.mutateAsync(values);
      reset();
      onHired();
    } catch (error) {
      setFailure(
        error instanceof ServiceRequestError
          ? error
          : { code: "employeesCreate.transport" },
      );
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">{t("people.form.title")}</CardTitle>
        <CardDescription>{t("people.form.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          aria-label={t("people.form.title")}
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hire-email">{t("people.form.email")}</Label>
              <Input
                id="hire-email"
                type="email"
                autoComplete="email"
                placeholder={t("people.form.emailPlaceholder")}
                {...register("userEmail")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hire-status">{t("people.form.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setValue("employmentStatus", value)
                }
              >
                <SelectTrigger id="hire-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIRE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(
                        `people.statuses.${STATUS_LABEL_KEYS[option] ?? "other"}`,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hire-join-date">
                {t("people.form.joinDate")}
              </Label>
              <Input
                id="hire-join-date"
                type="date"
                {...register("joinDate")}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              {t("people.form.roles")}
            </legend>
            <p className="text-xs text-muted-foreground">
              {t("people.form.rolesHint")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roleOptions.map((role) => (
                <label
                  key={role}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={roles.includes(role)}
                    onCheckedChange={(checked) =>
                      toggleRole(role, checked === true)
                    }
                  />
                  <span>{t(`people.roles.${ROLE_LABEL_KEYS[role]}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {invalidField ? (
            <Alert>{validationMessage(invalidField)}</Alert>
          ) : null}
          {failure ? (
            <Alert>{hireMessage(hireFailureReason(failure))}</Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={hireMutation.isPending}>
              {hireMutation.isPending
                ? t("people.form.submitting")
                : t("people.form.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={hireMutation.isPending}
              onClick={onCancel}
            >
              {t("people.form.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MembershipTable({ rows }: { rows: VenueMembership[] }) {
  const { t } = useTranslation("business");
  const { formatDate } = useFormatting();

  const roleLabel = (role: string) =>
    t(`people.roles.${ROLE_LABEL_KEYS[role] ?? "other"}`);
  const statusLabel = (status: string | undefined) =>
    status
      ? t(`people.statuses.${STATUS_LABEL_KEYS[status] ?? "other"}`)
      : t("people.notSet");

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.name")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.email")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.roles")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.status")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.joinDate")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr
              key={member._id}
              className="border-t border-border align-top"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {member.displayName}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {member.email}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {member.allEmployeeRoles.length > 0
                  ? member.allEmployeeRoles.map(roleLabel).join(", ")
                  : t("people.notSet")}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {statusLabel(member.employmentStatus)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {member.joinDate
                  ? formatDate(calendarDatePart(member.joinDate))
                  : t("people.notSet")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Venue People page (`/business/:businessId/people`).
 *
 * The access snapshot gates the page and filters assignable roles; the server
 * repeats both checks. The hire form is deliberately minimal: it never
 * collects pay, tax, identity, documents, or contract details.
 */
export default function BusinessPeoplePage() {
  const { t } = useTranslation("business");
  const { businessId } = useParams<{ businessId: string }>();
  const resolveError = useErrorMessage();
  const accessQuery = useBusinessAccessSnapshotQuery(businessId);
  const access = accessQuery.data;
  const canManage = canManageVenue(access);
  const membershipsQuery = useVenueMembershipsQuery(businessId, {
    enabled: canManage,
  });

  const [isHireOpen, setIsHireOpen] = useState(false);
  const [hired, setHired] = useState(false);

  const accessFailure =
    accessQuery.error instanceof ServiceRequestError
      ? accessQuery.error
      : null;
  const listFailure =
    membershipsQuery.error instanceof ServiceRequestError
      ? membershipsQuery.error
      : null;

  if (accessQuery.isLoading) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6" aria-busy="true">
        <span className="sr-only">{t("people.states.loading")}</span>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full max-w-4xl" />
        <Skeleton className="h-40 w-full max-w-4xl" />
      </main>
    );
  }

  if (isForbiddenFailure(accessFailure) || (access && !canManage)) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("people.title")}
        </h1>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4" aria-hidden />
              {t("people.states.accessDeniedTitle")}
            </CardTitle>
            <CardDescription>
              {t("people.states.accessDeniedDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (accessQuery.isError || !access) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("people.title")}
        </h1>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              {t("people.states.errorTitle")}
            </CardTitle>
            <CardDescription>
              {t("people.states.errorDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              {resolveError(
                accessFailure ?? { code: "businessAccess.transport" },
              )}
            </Alert>
            <Button
              type="button"
              variant="outline"
              onClick={() => void accessQuery.refetch()}
            >
              {t("people.states.retry")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Users className="size-5" aria-hidden />
            {t("people.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("people.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setHired(false);
            setIsHireOpen((open) => !open);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t("people.hireStaff")}
        </Button>
      </header>

      {hired ? (
        <Alert tone="success" className="w-full max-w-3xl">
          {t("people.messages.hired")}
        </Alert>
      ) : null}

      {isHireOpen ? (
        <HireStaffForm
          businessId={businessId as string}
          access={access}
          onHired={() => {
            setIsHireOpen(false);
            setHired(true);
          }}
          onCancel={() => setIsHireOpen(false)}
        />
      ) : null}

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-base">{t("people.list.title")}</CardTitle>
          <CardDescription>{t("people.list.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membershipsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {membershipsQuery.isError ? (
            <>
              <p className="font-medium text-foreground">
                {t("people.states.errorTitle")}
              </p>
              <Alert>
                {resolveError(
                  listFailure ?? { code: "employeesFetch.transport" },
                )}
              </Alert>
              <Button
                type="button"
                variant="outline"
                onClick={() => void membershipsQuery.refetch()}
              >
                {t("people.states.retry")}
              </Button>
            </>
          ) : null}

          {membershipsQuery.isSuccess &&
          (membershipsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-border p-6 text-center">
              <p className="font-medium text-foreground">
                {t("people.states.emptyTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("people.states.emptyDescription")}
              </p>
            </div>
          ) : null}

          {membershipsQuery.isSuccess &&
          (membershipsQuery.data?.length ?? 0) > 0 ? (
            <MembershipTable rows={membershipsQuery.data ?? []} />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
