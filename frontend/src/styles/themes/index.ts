export const THEMES = [{ id: "default", label: "Default" }] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME_ID: ThemeId = "default";

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    THEMES.some((theme) => theme.id === value)
  );
}
