import { Controller, useFieldArray, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessProfileFormValues } from "@/services/business/businessService";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import {
  DAY_OPTIONS,
  type BusinessProfileSettingsReady,
} from "@/hooks/useBusinessProfileSettingsController";

function DeliverySettingsLoadingBody() {
  return (
    <>
      <section className="space-y-4">
        <Skeleton className="h-4 w-36" aria-hidden />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" aria-hidden />
              <Skeleton className="h-10 w-full" aria-hidden />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-52" aria-hidden />
          <Skeleton className="h-8 w-36" aria-hidden />
        </div>
        <Skeleton className="h-4 w-full max-w-lg" aria-hidden />
        <div className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" aria-hidden />
            <Skeleton className="h-10 max-w-xs w-full" aria-hidden />
          </div>
          <div className="grid gap-3 form-grid-2-action">
            <Skeleton className="h-10 w-full" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
            <Skeleton className="h-10 w-24" aria-hidden />
          </div>
        </div>
      </section>
    </>
  );
}

/** Delivery flags, radius, minimum order, and per-day delivery windows. */
export default function BusinessDeliverySettingsPage() {
  return (
    <BusinessProfileSettingsFormShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <DeliverySettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <DeliverySections ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function DeliverySections({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { t } = useTranslation("business");
  const { register, control } = ctx;
  const deliveryWindowsFieldArray = useFieldArray({
    control,
    name: "deliveryOpeningWindows",
  });

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {t("deliverySettings.sectionTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp-accepts-delivery">{t("deliverySettings.acceptsDelivery")}</Label>
            <Controller
              control={control}
              name="acceptsDelivery"
              render={({ field }) => (
                <select
                  id="bp-accepts-delivery"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={field.value ? "yes" : "no"}
                  onChange={(event) => field.onChange(event.target.value === "yes")}
                >
                  <option value="yes">{t("deliverySettings.yes")}</option>
                  <option value="no">{t("deliverySettings.no")}</option>
                </select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-delivery-radius">{t("deliverySettings.deliveryRadius")}</Label>
            <Input
              id="bp-delivery-radius"
              type="number"
              step="0.01"
              {...register("deliveryRadius", {
                setValueAs: (value) => (value === "" ? null : Number(value)),
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-min-order">{t("deliverySettings.minOrder")}</Label>
            <Input
              id="bp-min-order"
              type="number"
              step="0.01"
              {...register("minOrder", {
                setValueAs: (value) => (value === "" ? null : Number(value)),
              })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("deliverySettings.windowsSectionTitle")}</h3>
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
            {t("deliverySettings.addDay")}
          </Button>
        </div>
        {deliveryWindowsFieldArray.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("deliverySettings.empty")}</p>
        ) : null}
        {deliveryWindowsFieldArray.fields.map((field, dayIndex) => (
          <div key={field.id} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`bp-delivery-day-${dayIndex}`}>{t("deliverySettings.day")}</Label>
              <Controller
                control={control}
                name={`deliveryOpeningWindows.${dayIndex}.dayOfWeek`}
                render={({ field: dayField }) => (
                  <select
                    id={`bp-delivery-day-${dayIndex}`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
                    value={dayField.value}
                    onChange={(event) => dayField.onChange(Number(event.target.value))}
                  >
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {t(day.labelKey)}
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
      </section>
    </>
  );
}

type DeliveryWindowsRowProps = {
  control: Control<BusinessProfileFormValues>;
  dayIndex: number;
  onRemoveDay: () => void;
};

/** Nested time windows for one `deliveryOpeningWindows` day entry. */
function DeliveryWindowsRow({ control, dayIndex, onRemoveDay }: DeliveryWindowsRowProps) {
  const { t } = useTranslation("business");
  const windowsFieldArray = useFieldArray({
    control,
    name: `deliveryOpeningWindows.${dayIndex}.windows` as const,
  });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemoveDay}>
          {t("deliverySettings.removeDay")}
        </Button>
      </div>
      {windowsFieldArray.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("deliverySettings.emptyWindows")}</p>
      ) : null}
      {windowsFieldArray.fields.map((windowField, windowIndex) => (
        <div key={windowField.id} className="grid gap-3 form-grid-2-action">
          <div className="space-y-2">
            <Label htmlFor={`bp-delivery-open-${dayIndex}-${windowIndex}`}>
              {t("deliverySettings.openTime")}
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
              {t("deliverySettings.closeTime")}
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
              {t("deliverySettings.removeWindow")}
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
        {t("deliverySettings.addWindow")}
      </Button>
    </div>
  );
}
