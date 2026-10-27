import type { i18n } from "i18next";
import { DEV_THEME_GALLERY_NAMESPACE } from "@/i18n/config";
import en from "@/i18n/locales/en/devThemeGallery.json";
import es from "@/i18n/locales/es/devThemeGallery.json";

export function registerThemeGalleryResources(instance: i18n): void {
  instance.addResourceBundle(
    "en",
    DEV_THEME_GALLERY_NAMESPACE,
    en,
    true,
    true,
  );
  instance.addResourceBundle(
    "es",
    DEV_THEME_GALLERY_NAMESPACE,
    es,
    true,
    true,
  );
}
