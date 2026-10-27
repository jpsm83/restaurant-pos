import type { i18n } from "i18next";
import en from "@/i18n/locales/en/devThemeGallery.json";
import es from "@/i18n/locales/es/devThemeGallery.json";

export function registerThemeGalleryResources(instance: i18n): void {
  instance.addResourceBundle(
    "en",
    "common",
    { devThemeGallery: en },
    true,
    true,
  );
  instance.addResourceBundle(
    "es",
    "common",
    { devThemeGallery: es },
    true,
    true,
  );
}
