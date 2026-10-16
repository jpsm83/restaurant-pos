import { Controller, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
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

function OpenHoursSettingsLoadingBody() {
  return (
    <section className="space-y-3 rounded-md border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-56" aria-hidden />
        <Skeleton className="h-8 w-36" aria-hidden />
      </div>
      <Skeleton className="h-4 w-full max-w-md" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Skeleton className="h-10 w-full" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
        <Skeleton className="h-10 w-full" aria-hidden />
        <Skeleton className="h-10 w-20" aria-hidden />
      </div>
    </section>
  );
}

/** In-venue business opening hours (self-order gating uses this schedule). */
export default function BusinessOpenHoursSettingsPage() {
  return (
    <BusinessProfileSettingsFormShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <OpenHoursSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <OpenHoursSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function OpenHoursSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { control } = ctx;
  const openingHoursFieldArray = useFieldArray({
    control,
    name: "businessOpeningHours",
  });

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">Business opening hours</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            openingHoursFieldArray.append({
              dayOfWeek: 1,
              openTime: "09:00",
              closeTime: "17:00",
            })
          }
        >
          Add opening day
        </Button>
      </div>
      {openingHoursFieldArray.fields.length === 0 ? (
        <p className="text-sm text-neutral-500">No opening hours configured yet.</p>
      ) : null}
      {openingHoursFieldArray.fields.map((field, index) => (
        <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor={`bp-opening-day-${index}`}>Day</Label>
            <Controller
              control={control}
              name={`businessOpeningHours.${index}.dayOfWeek`}
              render={({ field: dayField }) => (
                <select
                  id={`bp-opening-day-${index}`}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  value={dayField.value}
                  onChange={(event) => dayField.onChange(Number(event.target.value))}
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bp-opening-open-${index}`}>Open</Label>
            <Controller
              control={control}
              name={`businessOpeningHours.${index}.openTime`}
              render={({ field: openField }) => (
                <Input
                  id={`bp-opening-open-${index}`}
                  type="time"
                  value={openField.value}
                  onChange={openField.onChange}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bp-opening-close-${index}`}>Close</Label>
            <Controller
              control={control}
              name={`businessOpeningHours.${index}.closeTime`}
              render={({ field: closeField }) => (
                <Input
                  id={`bp-opening-close-${index}`}
                  type="time"
                  value={closeField.value}
                  onChange={closeField.onChange}
                />
              )}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openingHoursFieldArray.remove(index)}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
