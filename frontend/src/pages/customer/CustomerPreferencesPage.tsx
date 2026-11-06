/**
 * `/account/preferences` — account-scoped language and appearance settings.
 *
 * Each choice is applied immediately and then persisted through the
 * self-service profile API. The session hydration in `AuthProvider` makes the
 * stored language and theme win over the device cache after sign-in.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { changeAppLanguage } from "@/i18n/i18n";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n/config";

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

function effectiveLanguage(code: string): SupportedLanguage {
  const base = code.split("-")[0]?.toLowerCase() ?? "";
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

function PreferenceRadioOption<T extends string>({
  name,
  value,
  checked,
  label,
  onChange,
}: {
  name: string;
  value: T;
  checked: boolean;
  label: string;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground has-[:checked]:border-primary has-[:disabled]:cursor-not-allowed">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="size-4 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

/** Account-scoped Preferences page. */
export default function CustomerPreferencesPage() {
  const { t, i18n } = useTranslation("customer");
  const { state, dispatch } = useAuth();
  const { mode, setMode } = useTheme();
  const languageOptions = useLanguageOptions();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSaveFailed, setLanguageSaveFailed] = useState(false);

  const sessionUser =
    state.status === "authenticated" && state.user?.type === "user"
      ? state.user
      : null;
  const userId = sessionUser?.id;
  const currentLanguage = effectiveLanguage(i18n.language);

  async function onLanguageChange(nextLanguage: SupportedLanguage) {
    setLanguageSaveFailed(false);
    setSavingLanguage(true);
    await changeAppLanguage(nextLanguage);

    if (!userId) {
      setSavingLanguage(false);
      return;
    }

    const data = new FormData();
    data.append("languagePreference", nextLanguage);

    const result = await updateUserProfile(userId, data);
    setSavingLanguage(false);

    if (!result.ok) {
      setLanguageSaveFailed(true);
      return;
    }

    const updated = result.data?.user ?? null;
    if (sessionUser && updated) {
      dispatch({
        type: "AUTH_SUCCESS",
        payload: {
          ...sessionUser,
          languagePreference: updated.languagePreference ?? nextLanguage,
        },
      });
    }
  }

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
        aria-labelledby="preferences-language-heading"
      >
        <div className="space-y-1">
          <h2
            id="preferences-language-heading"
            className="text-base font-semibold text-foreground"
          >
            {t("preferences.language.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("preferences.language.description")}
          </p>
        </div>

        <fieldset
          className="space-y-2"
          disabled={savingLanguage}
          aria-describedby={
            languageSaveFailed ? "preferences-language-error" : undefined
          }
        >
          <legend className="sr-only">{t("preferences.language.legend")}</legend>
          {languageOptions.map((option) => (
            <PreferenceRadioOption
              key={option.value}
              name="language"
              value={option.value}
              checked={currentLanguage === option.value}
              label={option.label}
              onChange={(value) => void onLanguageChange(value)}
            />
          ))}
        </fieldset>

        {languageSaveFailed ? (
          <p
            id="preferences-language-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {t("preferences.errors.saveLanguage")}
          </p>
        ) : null}
      </section>

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
            <PreferenceRadioOption
              key={option.value}
              name="appearance"
              value={option.value}
              checked={mode === option.value}
              label={t(option.labelKey)}
              onChange={(value) => void onAppearanceChange(value)}
            />
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
