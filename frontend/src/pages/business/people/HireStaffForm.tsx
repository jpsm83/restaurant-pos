/**
 * Minimal hire form — sign-in email, job roles, employment status, join date.
 *
 * Deliberately excludes pay, tax, identity, documents, and contract details.
 * Role choices come from the caller's assignment bounds and the server repeats
 * the same check.
 */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { EmploymentStatus } from "restaurant-pos-packages/enums";
import {
  hireEmployeeFormSchema,
  type HireEmployeeFormValues,
} from "restaurant-pos-packages/schemas/employee";

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
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import { formatCalendarDate } from "@/lib/calendarDate";
import {
  hireFailureReason,
  useHireEmployeeMutation,
  type BusinessAccessSnapshot,
  type HireFailureReason,
} from "@/services/employees/employeesService";
import { ServiceRequestError } from "@/services/serviceErrors";
import {
  HIRE_STATUS_OPTIONS,
  roleLabelKey,
  statusLabelKey,
} from "./peopleLabels";
import { roleOptionsFor } from "./roleOptions";

type HireField = "userEmail" | "allEmployeeRoles" | "joinDate";

const HIRE_FIELD_ORDER: HireField[] = [
  "userEmail",
  "allEmployeeRoles",
  "joinDate",
];

export default function HireStaffForm({
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
  } = useForm<HireEmployeeFormValues>({
    resolver: zodResolver(hireEmployeeFormSchema),
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

  const onSubmit = async (values: HireEmployeeFormValues) => {
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
          noValidate
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
                  setValue("employmentStatus", value as EmploymentStatus)
                }
              >
                <SelectTrigger id="hire-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIRE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`people.statuses.${statusLabelKey(option)}`)}
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
                  <span>{t(`people.roles.${roleLabelKey(role)}`)}</span>
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
