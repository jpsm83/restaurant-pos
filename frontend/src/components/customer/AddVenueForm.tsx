import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { currenctyEnums } from "restaurant-pos-packages/enums";
import type { IOwnerPortfolioCompany } from "restaurant-pos-packages/interfaces/IOwner";
import {
  buildCreateBusinessBodySchema,
  type CreateBusinessBody,
} from "restaurant-pos-packages/schemas/business";
import { FieldError } from "@/components/FieldError";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  useCreateVenueMutation,
  type CreateVenueInput,
} from "@/services/portfolio/portfolioService";
import { ServiceRequestError } from "@/services/serviceErrors";
import { companyDisplayName } from "./companyDisplayName";

const currencyTuple = currenctyEnums as [string, ...string[]];
const NEW_COMPANY = "__new_company__";

type VenueFormValues = CreateBusinessBody;
type ExistingCompany = Pick<
  IOwnerPortfolioCompany,
  "_id" | "legalName" | "taxNumber"
>;

export function AddVenueForm(props: {
  companies?: readonly ExistingCompany[];
  defaultCountry: string | null;
  /** Pre-select this Company when it appears in `companies` (Company page entry). */
  defaultCompanyId?: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation("customer");
  const createVenueMutation = useCreateVenueMutation();
  const resolveError = useErrorMessage();
  const [failure, setFailure] = useState<ErrorFailure | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const companies = props.companies ?? [];
  const [companyChoice, setCompanyChoice] = useState<string | undefined>(() => {
    if (
      props.defaultCompanyId &&
      companies.some((company) => company._id === props.defaultCompanyId)
    ) {
      return props.defaultCompanyId;
    }
    return companies.length > 0 ? undefined : NEW_COMPANY;
  });
  const isNewCompany = companyChoice === NEW_COMPANY;

  const schema = useMemo(
    () =>
      buildCreateBusinessBodySchema({
        tradeNameRequired: t("venues.form.validation.tradeNameRequired"),
        countryRequired: t("venues.form.validation.countryRequired"),
        invalidCurrency: t("venues.form.validation.invalidCurrency"),
      }),
    [t],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VenueFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeName: "",
      country: props.defaultCountry ?? "",
      currencyTrade: currencyTuple[0] ?? "USD",
      company: { legalName: "", taxNumber: "" },
    },
  });

  const onSubmit = async (values: VenueFormValues) => {
    setFailure(null);
    if (!companyChoice) {
      setCompanyError(t("venues.form.company.required"));
      return;
    }
    setCompanyError(null);
    const input: CreateVenueInput = {
      tradeName: values.tradeName,
      country: values.country,
      currencyTrade: values.currencyTrade,
      ...(isNewCompany
        ? {
            company: {
              legalName: values.company?.legalName,
              taxNumber: values.company?.taxNumber,
            },
          }
        : { companyId: companyChoice }),
    };
    try {
      await createVenueMutation.mutateAsync(input);
      props.onCreated();
    } catch (error) {
      setFailure(
        error instanceof ServiceRequestError
          ? error
          : { code: "businessCreate.transport" },
      );
    }
  };

  const isSubmitting = createVenueMutation.isPending;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="venue-trade-name">
            {t("venues.form.fields.tradeName")}
          </Label>
          <Input
            id="venue-trade-name"
            aria-invalid={errors.tradeName ? true : undefined}
            {...register("tradeName")}
          />
          <FieldError message={errors.tradeName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue-country">
            {t("venues.form.fields.country")}
          </Label>
          <Input
            id="venue-country"
            aria-invalid={errors.country ? true : undefined}
            readOnly={props.defaultCountry !== null}
            {...register("country")}
          />
          <FieldError message={errors.country?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue-currency">
            {t("venues.form.fields.currency")}
          </Label>
          <Controller
            control={control}
            name="currencyTrade"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="venue-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currenctyEnums.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.currencyTrade?.message} />
        </div>
      </div>

      {companies.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="venue-company">
            {t("venues.form.fields.company")}
          </Label>
          <Select
            value={companyChoice}
            onValueChange={(value) => {
              setCompanyChoice(value);
              setCompanyError(null);
            }}
          >
            <SelectTrigger id="venue-company" className="w-full">
              <SelectValue placeholder={t("venues.form.company.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company, index) => (
                <SelectItem key={company._id} value={company._id}>
                  {companyDisplayName(
                    company,
                    t("venues.companyFallback", { index: index + 1 }),
                  )}
                </SelectItem>
              ))}
              <SelectItem value={NEW_COMPANY}>
                {t("venues.form.company.new")}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {isNewCompany
              ? t("venues.form.company.newHint")
              : t("venues.form.company.existingHint")}
          </p>
          <FieldError message={companyError ?? undefined} />
        </div>
      ) : null}

      {isNewCompany ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="venue-legal-name">
              {t("venues.form.fields.legalName")}
            </Label>
            <Input
              id="venue-legal-name"
              aria-invalid={errors.company?.legalName ? true : undefined}
              {...register("company.legalName")}
            />
            <p className="text-xs text-muted-foreground">
              {t("venues.form.fields.legalNameHint")}
            </p>
            <FieldError message={errors.company?.legalName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-tax-number">
              {t("venues.form.fields.taxNumber")}
            </Label>
            <Input
              id="venue-tax-number"
              aria-invalid={errors.company?.taxNumber ? true : undefined}
              {...register("company.taxNumber")}
            />
            <p className="text-xs text-muted-foreground">
              {t("venues.form.fields.taxNumberHint")}
            </p>
            <FieldError message={errors.company?.taxNumber?.message} />
          </div>
        </div>
      ) : null}

      {failure ? <Alert>{resolveError(failure)}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t("venues.form.submitting")
            : t("venues.form.submit")}
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          {t("venues.form.cancel")}
        </Button>
      </div>
    </form>
  );
}
