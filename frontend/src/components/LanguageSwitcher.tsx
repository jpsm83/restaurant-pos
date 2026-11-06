import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateUserProfile } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import { CircularFlag } from "@/components/LanguageFlag";
import { changeAppLanguage } from "@/i18n/i18n";
import { effectiveLanguage, isSupportedLanguage } from "@/i18n/config";
import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const { state, dispatch } = useAuth();
  const options = useLanguageOptions();
  const active = effectiveLanguage(i18n.language || "en");

  async function changeLanguage(code: string) {
    await changeAppLanguage(code);

    const user =
      state.status === "authenticated" && state.user?.type === "user"
        ? state.user
        : null;
    if (!user || !isSupportedLanguage(code) || user.languagePreference === code) {
      return;
    }

    const formData = new FormData();
    formData.append("languagePreference", code);
    const result = await updateUserProfile(user.id, formData);
    if (!result.ok) {
      toast.error(t("languageSwitcher.saveError"));
      return;
    }
    dispatch({
      type: "AUTH_SUCCESS",
      payload: { ...user, languagePreference: code },
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={null}
          className="hover:bg-transparent hover:cursor-pointer"
          aria-label={t("languageSwitcher.ariaLabel")}
        >
          <CircularFlag code={active} sizeClass="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-45 max-w-sm p-2"
        onFocusOutside={(e: Event) => e.preventDefault() }
      >
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(code) => void changeLanguage(code)}
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              <CircularFlag code={opt.value} sizeClass="h-4 w-4" />
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
