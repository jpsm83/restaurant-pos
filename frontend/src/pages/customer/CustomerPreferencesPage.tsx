/**
 * `/account/preferences` — account-scoped appearance settings.
 *
 * The appearance is applied to the theme store immediately and then persisted
 * through the self-service profile API. The session hydration in `AuthProvider`
 * makes the stored choice win over the device cache after sign-in.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";

const APPEARANCE_OPTIONS: Array<{
  value: ThemeMode;
  labelKey:
    | "preferences.appearance.options.light"
    | "preferences.appearance.options.dark"
    | "preferences.appearance.options.system";
}> = [
  { value: "light", labelKey: "preferences.appearance.options.light" },
  { value: "dark", labelKey: "preferences.appearance.options.dark" },
  { value: "system", labelKey: "preferences.appearance.options.system" },
];

/** Account-scoped Preferences page. */
export default function CustomerPreferencesPage() {
  const { t } = useTranslation("customer");
  const { state, dispatch } = useAuth();
  const { mode, setMode } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const sessionUser =
    state.status === "authenticated" && state.user?.type === "user"
      ? state.user
      : null;
  const userId = sessionUser?.id;

  async function onAppearanceChange(nextMode: ThemeMode) {
    setMode(nextMode);
    setSaveFailed(false);
    if (!userId) return;

    const data = new FormData();
    data.append("themePreference", nextMode);

    setSaving(true);
    const result = await updateUserProfile(userId, data);
    setSaving(false);

    if (!result.ok) {
      setSaveFailed(true);
      return;
    }

    const updated = result.data?.user ?? null;
    if (sessionUser && updated) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: {
          ...sessionUser,
          themePreference: updated.themePreference,
        },
      });
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {t("preferences.title")}
      </h1>

      <section
        className="mt-6 max-w-2xl space-y-4"
        aria-labelledby="preferences-appearance-heading"
      >
        <div className="space-y-1">
          <h2
            id="preferences-appearance-heading"
            className="text-base font-semibold text-foreground"
          >
            {t("preferences.appearance.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("preferences.appearance.description")}
          </p>
        </div>

        <fieldset
          className="space-y-2"
          disabled={saving}
          aria-describedby={
            saveFailed ? "preferences-appearance-error" : undefined
          }
        >
          <legend className="sr-only">
            {t("preferences.appearance.legend")}
          </legend>
          {APPEARANCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground has-[:checked]:border-primary has-[:disabled]:cursor-not-allowed"
            >
              <input
                type="radio"
                name="appearance"
                value={option.value}
                checked={mode === option.value}
                onChange={() => void onAppearanceChange(option.value)}
                className="size-4 accent-primary"
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </fieldset>

        {saveFailed ? (
          <p
            id="preferences-appearance-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {t("preferences.errors.save")}
          </p>
        ) : null}
      </section>
    </main>
  );
}
