import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import {
  DAY_OPTIONS,
  type BusinessProfileSettingsReady,
} from "@/hooks/useBusinessProfileSettingsController";

function MetricsSettingsLoadingBody() {
  return (
    <>
      <section className="space-y-4">
        <Skeleton className="h-4 w-24" aria-hidden />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" aria-hidden />
              <Skeleton className="h-10 w-full" aria-hidden />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <Skeleton className="h-4 w-28" aria-hidden />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
        </div>
      </section>
    </>
  );
}

/** Cost and waste target metrics plus weekly report start day. */
export default function BusinessMetricsSettingsPage() {
  return (
    <BusinessProfileSettingsFormShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <MetricsSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <MetricsSections ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function MetricsSections({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { register, control } = ctx;

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">Metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp-metric-food">Food cost percentage</Label>
            <Input
              id="bp-metric-food"
              type="number"
              step="0.01"
              {...register("metrics.foodCostPercentage", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-beverage">Beverage cost percentage</Label>
            <Input
              id="bp-metric-beverage"
              type="number"
              step="0.01"
              {...register("metrics.beverageCostPercentage", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-labor">Labor cost percentage</Label>
            <Input
              id="bp-metric-labor"
              type="number"
              step="0.01"
              {...register("metrics.laborCostPercentage", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-fixed">Fixed cost percentage</Label>
            <Input
              id="bp-metric-fixed"
              type="number"
              step="0.01"
              {...register("metrics.fixedCostPercentage", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-vlow">Waste very low impact</Label>
            <Input
              id="bp-metric-vlow"
              type="number"
              step="0.01"
              {...register("metrics.supplierGoodWastePercentage.veryLowBudgetImpact", {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-low">Waste low impact</Label>
            <Input
              id="bp-metric-low"
              type="number"
              step="0.01"
              {...register("metrics.supplierGoodWastePercentage.lowBudgetImpact", {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-medium">Waste medium impact</Label>
            <Input
              id="bp-metric-medium"
              type="number"
              step="0.01"
              {...register("metrics.supplierGoodWastePercentage.mediumBudgetImpact", {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-high">Waste high impact</Label>
            <Input
              id="bp-metric-high"
              type="number"
              step="0.01"
              {...register("metrics.supplierGoodWastePercentage.hightBudgetImpact", {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-metric-vhigh">Waste very high impact</Label>
            <Input
              id="bp-metric-vhigh"
              type="number"
              step="0.01"
              {...register("metrics.supplierGoodWastePercentage.veryHightBudgetImpact", {
                valueAsNumber: true,
              })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">Reporting</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
                      event.target.value === "" ? null : Number(event.target.value),
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
    </>
  );
}
