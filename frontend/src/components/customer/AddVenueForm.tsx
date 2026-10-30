import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { currenctyEnums } from "restaurant-pos-packages/enums";
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
import { useCreateVenueMutation } from "@/services/portfolio/portfolioService";
import { ServiceRequestError } from "@/services/serviceErrors";

const currencyTuple = currenctyEnums as [string, ...string[]];

type VenueFormValues = CreateBusinessBody;

export function AddVenueForm(props: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation("customer");
  const createVenueMutation = useCreateVenueMutation();
  const resolveError = useErrorMessage();
  const [failure, setFailure] = useState<ErrorFailure | null>(null);

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
      country: "",
      currencyTrade: currencyTuple[0] ?? "USD",
      company: { legalName: "", taxNumber: "" },
    },
  });

  const onSubmit = async (values: VenueFormValues) => {
    setFailure(null);
    try {
      await createVenueMutation.mutateAsync({
        tradeName: values.tradeName,
        country: values.country,
        currencyTrade: values.currencyTrade,
        company: {
          legalName: values.company?.legalName,
          taxNumber: values.company?.taxNumber,
        },
      });
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
