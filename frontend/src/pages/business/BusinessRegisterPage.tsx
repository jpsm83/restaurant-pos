import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBusinessMutation } from "@/services/businessService";
import { currenctyEnums, subscriptionEnums } from "@packages/enums.ts";
import { isValidPassword } from "@packages/utils/passwordPolicy.ts";
import emailRegex from "@packages/utils/emailRegex.ts";

const selectClassName = "flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50";

const subscriptionTuple = subscriptionEnums as [string, ...string[]];
const currencyTuple = currenctyEnums as [string, ...string[]];

function buildBusinessRegisterSchema(messages: {
  requiredField: string;
  invalidEmail: string;
  passwordMismatch: string;
  passwordPolicy: string;
  invalidSubscription: string;
  invalidCurrency: string;
}) {
  return z
    .object({
      tradeName: z.string().trim().min(1, messages.requiredField),
      legalName: z.string().trim().min(1, messages.requiredField),
      email: z
        .string()
        .trim()
        .min(1, messages.requiredField)
        .regex(emailRegex, messages.invalidEmail),
      password: z.string().min(1, messages.requiredField),
      confirmPassword: z.string().min(1, messages.requiredField),
      phoneNumber: z.string().trim().min(1, messages.requiredField),
      taxNumber: z.string().trim().min(1, messages.requiredField),
      subscription: z.enum(subscriptionTuple, messages.invalidSubscription),
      currencyTrade: z.enum(currencyTuple, messages.invalidCurrency),
      contactPerson: z.string(),
      country: z.string().trim().min(1, messages.requiredField),
      state: z.string().trim().min(1, messages.requiredField),
      city: z.string().trim().min(1, messages.requiredField),
      street: z.string().trim().min(1, messages.requiredField),
      buildingNumber: z.string().trim().min(1, messages.requiredField),
      doorNumber: z.string(),
      complement: z.string(),
      postCode: z.string().trim().min(1, messages.requiredField),
      region: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordMismatch,
      path: ["confirmPassword"],
    })
    .refine(
      (data) =>
        data.password !== data.confirmPassword ||
        isValidPassword(data.password),
      {
        message: messages.passwordPolicy,
        path: ["password"],
      },
    );
}

type BusinessRegisterFormValues = z.infer<
  ReturnType<typeof buildBusinessRegisterSchema>
>;

/**
 * Multipart **`POST /api/v1/business`** — required fields match **`backend/src/routes/v1/business.ts`** (Phase 4.2).
 */
export default function BusinessRegisterPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const mutation = useCreateBusinessMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      buildBusinessRegisterSchema({
        requiredField: t("businessRegister.errors.requiredFields"),
        invalidEmail: t("businessRegister.errors.invalidEmail"),
        passwordMismatch: t("businessRegister.errors.passwordMismatch"),
        passwordPolicy: t("businessRegister.errors.passwordPolicy"),
        invalidSubscription: t("businessRegister.errors.invalidSubscription"),
        invalidCurrency: t("businessRegister.errors.invalidCurrency"),
      }),
    [t],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessRegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeName: "",
      legalName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      taxNumber: "",
      subscription: subscriptionEnums[0] ?? "Free",
      currencyTrade: currenctyEnums[0] ?? "USD",
      contactPerson: "",
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
  });

  const onSubmit = async (data: BusinessRegisterFormValues) => {
    setSubmitError(null);

    const address: Record<string, string> = {
      country: data.country.trim(),
      state: data.state.trim(),
      city: data.city.trim(),
      street: data.street.trim(),
      buildingNumber: data.buildingNumber.trim(),
      postCode: data.postCode.trim(),
    };
    const r = data.region.trim();
    if (r) address.region = r;
    const d = data.doorNumber.trim();
    if (d) address.doorNumber = d;
    const c = data.complement.trim();
    if (c) address.complement = c;

    const formData = new FormData();
    formData.append("tradeName", data.tradeName.trim());
    formData.append("legalName", data.legalName.trim());
    formData.append("email", data.email.trim());
    formData.append("password", data.password);
    formData.append("phoneNumber", data.phoneNumber.trim());
    formData.append("taxNumber", data.taxNumber.trim());
    formData.append("subscription", data.subscription);
    formData.append("currencyTrade", data.currencyTrade);
    formData.append("address", JSON.stringify(address));
    const cp = data.contactPerson.trim();
    if (cp) formData.append("contactPerson", cp);

    try {
      const result = await mutation.mutateAsync(formData);
      localStorage.setItem("auth_had_session", "1");
      dispatch({ type: "AUTH_SUCCESS", payload: result.user });
      navigate(getPostLoginDestination(result.user), { replace: true });
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : t("businessRegister.errors.registrationFailed"),
      );
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("businessRegister.title")}</CardTitle>
          <CardDescription>{t("businessRegister.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          >
            {submitError ? <Alert>{submitError}</Alert> : null}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {t("businessRegister.sections.business")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-trade">{t("businessRegister.labels.tradeName")}</Label>
                  <Input
                    id="br-trade"
                    autoComplete="organization"
                    aria-invalid={errors.tradeName ? true : undefined}
                    {...register("tradeName")}
                  />
                  <FieldError message={errors.tradeName?.message} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-legal">{t("businessRegister.labels.legalName")}</Label>
                  <Input
                    id="br-legal"
                    aria-invalid={errors.legalName ? true : undefined}
                    {...register("legalName")}
                  />
                  <FieldError message={errors.legalName?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-email">{t("businessRegister.labels.email")}</Label>
                  <Input
                    id="br-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={errors.email ? true : undefined}
                    {...register("email")}
                  />
                  <FieldError message={errors.email?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-phone">{t("businessRegister.labels.phoneNumber")}</Label>
                  <Input
                    id="br-phone"
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={errors.phoneNumber ? true : undefined}
                    {...register("phoneNumber")}
                  />
                  <FieldError message={errors.phoneNumber?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-tax">{t("businessRegister.labels.taxNumber")}</Label>
                  <Input
                    id="br-tax"
                    aria-invalid={errors.taxNumber ? true : undefined}
                    {...register("taxNumber")}
                  />
                  <FieldError message={errors.taxNumber?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-contact">{t("businessRegister.labels.contactPerson")}</Label>
                  <Input
                    id="br-contact"
                    aria-invalid={errors.contactPerson ? true : undefined}
                    {...register("contactPerson")}
                  />
                  <FieldError message={errors.contactPerson?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-sub">{t("businessRegister.labels.subscription")}</Label>
                  <Controller
                    name="subscription"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="br-sub"
                          className={selectClassName}
                          aria-invalid={errors.subscription ? true : undefined}
                        >
                          <SelectValue
                            placeholder={t("businessRegister.labels.subscription")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {subscriptionEnums.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.subscription?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-currency">{t("businessRegister.labels.currency")}</Label>
                  <Controller
                    name="currencyTrade"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="br-currency"
                          className={selectClassName}
                          aria-invalid={
                            errors.currencyTrade ? true : undefined
                          }
                        >
                          <SelectValue
                            placeholder={t("businessRegister.labels.currency")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {currenctyEnums.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.currencyTrade?.message} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {t("businessRegister.sections.password")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="br-password">{t("businessRegister.labels.password")}</Label>
                  <Input
                    id="br-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? true : undefined}
                    {...register("password")}
                  />
                  <FieldError message={errors.password?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-confirm">
                    {t("businessRegister.labels.confirmPassword")}
                  </Label>
                  <Input
                    id="br-confirm"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={errors.confirmPassword ? true : undefined}
                    {...register("confirmPassword")}
                  />
                  <FieldError message={errors.confirmPassword?.message} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {t("businessRegister.sections.address")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="br-country">{t("businessRegister.labels.country")}</Label>
                  <Input
                    id="br-country"
                    autoComplete="country-name"
                    aria-invalid={errors.country ? true : undefined}
                    {...register("country")}
                  />
                  <FieldError message={errors.country?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-state">{t("businessRegister.labels.stateRegion")}</Label>
                  <Input
                    id="br-state"
                    autoComplete="address-level1"
                    aria-invalid={errors.state ? true : undefined}
                    {...register("state")}
                  />
                  <FieldError message={errors.state?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-city">{t("businessRegister.labels.city")}</Label>
                  <Input
                    id="br-city"
                    autoComplete="address-level2"
                    aria-invalid={errors.city ? true : undefined}
                    {...register("city")}
                  />
                  <FieldError message={errors.city?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-street">{t("businessRegister.labels.street")}</Label>
                  <Input
                    id="br-street"
                    autoComplete="street-address"
                    aria-invalid={errors.street ? true : undefined}
                    {...register("street")}
                  />
                  <FieldError message={errors.street?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-building">
                    {t("businessRegister.labels.buildingNumber")}
                  </Label>
                  <Input
                    id="br-building"
                    aria-invalid={errors.buildingNumber ? true : undefined}
                    {...register("buildingNumber")}
                  />
                  <FieldError message={errors.buildingNumber?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-door">{t("businessRegister.labels.doorNumber")}</Label>
                  <Input
                    id="br-door"
                    placeholder={t("businessRegister.placeholders.doorNumber")}
                    aria-invalid={errors.doorNumber ? true : undefined}
                    {...register("doorNumber")}
                  />
                  <FieldError message={errors.doorNumber?.message} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-complement">{t("businessRegister.labels.complement")}</Label>
                  <Input
                    id="br-complement"
                    placeholder={t("businessRegister.placeholders.complement")}
                    aria-invalid={errors.complement ? true : undefined}
                    {...register("complement")}
                  />
                  <FieldError message={errors.complement?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-post">{t("businessRegister.labels.postCode")}</Label>
                  <Input
                    id="br-post"
                    autoComplete="postal-code"
                    aria-invalid={errors.postCode ? true : undefined}
                    {...register("postCode")}
                  />
                  <FieldError message={errors.postCode?.message} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-region-extra">
                    {t("businessRegister.labels.regionOptional")}
                  </Label>
                  <Input
                    id="br-region-extra"
                    placeholder={t("businessRegister.placeholders.regionOptional")}
                    aria-invalid={errors.region ? true : undefined}
                    {...register("region")}
                  />
                  <FieldError message={errors.region?.message} />
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? t("businessRegister.submitting")
                  : t("businessRegister.submit")}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/business">{t("businessRegister.backLink")}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
