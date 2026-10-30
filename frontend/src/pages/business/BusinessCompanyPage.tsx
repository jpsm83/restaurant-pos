import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Building2, Plus } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { AddVenueForm } from "@/components/customer/AddVenueForm";
import { companyDisplayName } from "@/components/customer/companyDisplayName";
import { FieldError } from "@/components/FieldError";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import {
  findOwnedCompany,
  useOwnerPortfolioQuery,
  useUpdateCompanyMutation,
} from "@/services/portfolio/portfolioService";
import { ServiceRequestError } from "@/services/serviceErrors";
import {
  updateCompanyBodySchema,
  type UpdateCompanyBody,
} from "restaurant-pos-packages/schemas/company";

/**
 * Company page (`/business/:businessId/company`) — the active venue's tax
 * entity, reachable from the Business shell for the owning User only.
 *
 * The Company is read from the caller's portfolio, so a non-owner staff member
 * gets no Company or portfolio data even when they reach this URL. Editing is
 * owner-scoped on the API as well.
 */
export default function BusinessCompanyPage() {
  const { t } = useTranslation("business");
  const { businessId } = useParams<{ businessId: string }>();
  const { state } = useAuth();
  const userId = state.user?.id;
  const portfolioQuery = useOwnerPortfolioQuery(userId);
  const resolveError = useErrorMessage();
  const [failure, setFailure] = useState<ErrorFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [isAddingVenue, setIsAddingVenue] = useState(false);

  const company = businessId
    ? findOwnedCompany(portfolioQuery.data, businessId)
    : undefined;
  const updateCompanyMutation = useUpdateCompanyMutation(company?._id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateCompanyBody>({
    resolver: zodResolver(updateCompanyBodySchema),
    defaultValues: { legalName: undefined, taxNumber: undefined },
  });

  useEffect(() => {
    if (!company) return;
    reset({ legalName: company.legalName, taxNumber: company.taxNumber });
  }, [company, reset]);

  const queryFailure =
    portfolioQuery.error instanceof ServiceRequestError
      ? portfolioQuery.error
      : null;

  const onSubmit = async (values: UpdateCompanyBody) => {
    setFailure(null);
    setSaved(false);
    try {
      await updateCompanyMutation.mutateAsync(values);
      reset(values);
      setSaved(true);
    } catch (error) {
      setFailure(
        error instanceof ServiceRequestError
          ? error
          : { code: "companyUpdate.transport" },
      );
    }
  };

  if (portfolioQuery.isLoading) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </main>
    );
  }

  if (portfolioQuery.isError) {
    return (
      <main className="min-h-0 flex-1 space-y-3 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("company.title")}
        </h1>
        <Alert>
          {resolveError(queryFailure ?? { code: "portfolioFetch.transport" })}
        </Alert>
        <Button
          type="button"
          variant="outline"
          onClick={() => void portfolioQuery.refetch()}
        >
          {t("company.retry")}
        </Button>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="min-h-0 flex-1 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("company.title")}
        </h1>
        <Card className="mt-6 w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{t("company.unavailableTitle")}</CardTitle>
            <CardDescription>
              {t("company.unavailableDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const isSaving = updateCompanyMutation.isPending;

  return (
    <main className="min-h-0 flex-1 space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">
          {t("company.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("company.description")}
        </p>
      </header>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" aria-hidden />
            {companyDisplayName(
              company,
              t("company.fallbackName", { id: company._id }),
            )}
          </CardTitle>
          <CardDescription>{t("company.identityDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-legal-name">
                  {t("company.fields.legalName")}
                </Label>
                <Input
                  id="company-legal-name"
                  aria-invalid={errors.legalName ? true : undefined}
                  {...register("legalName", {
                    setValueAs: (value: string) =>
                      value.trim() === "" ? null : value,
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("company.fields.legalNameHint")}
                </p>
                <FieldError message={errors.legalName?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-tax-number">
                  {t("company.fields.taxNumber")}
                </Label>
                <Input
                  id="company-tax-number"
                  aria-invalid={errors.taxNumber ? true : undefined}
                  {...register("taxNumber", {
                    setValueAs: (value: string) =>
                      value.trim() === "" ? null : value,
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("company.fields.taxNumberHint")}
                </p>
                <FieldError message={errors.taxNumber?.message} />
              </div>
            </div>

            {failure ? <Alert>{resolveError(failure)}</Alert> : null}
            {saved ? (
              <p className="text-sm text-muted-foreground">
                {t("company.saved")}
              </p>
            ) : null}

            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("company.saving") : t("company.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t("company.venuesTitle")}</CardTitle>
          <CardDescription>{t("company.venuesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {company.businesses.map((business) => (
              <li
                key={business._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">
                  {business.tradeName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("company.venueMeta", {
                    country: business.address?.country ?? company.country,
                    currency: business.currencyTrade,
                  })}
                </span>
              </li>
            ))}
          </ul>

          {isAddingVenue ? (
            <AddVenueForm
              companies={portfolioQuery.data?.companies}
              defaultCountry={portfolioQuery.data?.country ?? null}
              defaultCompanyId={company._id}
              onCancel={() => setIsAddingVenue(false)}
              onCreated={() => setIsAddingVenue(false)}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddingVenue(true)}
            >
              <Plus className="size-4" aria-hidden />
              {t("company.addVenue")}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
