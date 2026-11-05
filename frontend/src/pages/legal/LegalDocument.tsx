import { useTranslation } from "react-i18next";
import { useFormatting } from "@/hooks/useFormatting";

/** Placeholder publication date for the legal documents until legal copy lands. */
const LEGAL_LAST_UPDATED = "2026-11-05";

interface LegalDocumentProps {
  title: string;
  body: string;
}

/** Shared public legal document shell: title, placeholder body, and last-updated line. */
export default function LegalDocument({ title, body }: LegalDocumentProps) {
  const { t } = useTranslation("marketing");
  const { formatDate } = useFormatting();

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-10 sm:px-6 lg:px-8">
      <article className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{body}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          {t("legal.lastUpdated", {
            date: formatDate(LEGAL_LAST_UPDATED),
          })}
        </p>
      </article>
    </main>
  );
}
