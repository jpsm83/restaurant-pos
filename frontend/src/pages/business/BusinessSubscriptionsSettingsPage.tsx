import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { subscriptionEnums } from "@packages/enums.ts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
} from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

function SubscriptionsSettingsLoadingBody() {
  return (
    <section className="space-y-3">
      <Skeleton className="h-4 w-32" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" aria-hidden />
        ))}
      </div>
    </section>
  );
}

/** Subscription plan selection for the business tenant. */
export default function BusinessSubscriptionsSettingsPage() {
  return (
    <BusinessProfileSettingsFormShell
      loadingSlot={
        <BusinessProfileSettingsLoadingCard>
          <SubscriptionsSettingsLoadingBody />
        </BusinessProfileSettingsLoadingCard>
      }
    >
      {(ctx) => <SubscriptionSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function SubscriptionSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { control, setValue } = ctx;
  const { t } = useTranslation("business");
  const selectedSubscription = useWatch({ control, name: "subscription" });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
        {t("subscriptionSettings.sectionTitle")}
      </h2>
      <div
        role="radiogroup"
        aria-label={t("subscriptionSettings.planGroupAriaLabel")}
        className="grid gap-3 sm:grid-cols-3"
      >
        {subscriptionEnums.map((plan) => {
          const isSelected = selectedSubscription === plan;
          return (
            <button
              key={plan}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t("subscriptionSettings.selectPlanAriaLabel", { plan })}
              className={`rounded-lg border p-4 text-left transition ${
                isSelected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500"
              }`}
              onClick={() => setValue("subscription", plan, { shouldDirty: true })}
            >
              <p className="font-semibold">{plan}</p>
              <p
                className={`mt-1 text-xs ${
                  isSelected ? "text-neutral-200" : "text-neutral-500"
                }`}
              >
                {t("subscriptionSettings.selectedPlanDescription")}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
