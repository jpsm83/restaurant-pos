import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BusinessMarketingPage() {
  const { t } = useTranslation("nav");
  const highlights = [
    t("marketing.business.highlights.pos"),
    t("marketing.business.highlights.inventory"),
    t("marketing.business.highlights.reports"),
  ];

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-neutral-100 px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t("marketing.business.title")}</CardTitle>
          <CardDescription>{t("marketing.business.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-neutral-700">
            {t("marketing.business.footer")}
          </p>
          <Button asChild>
            <a href="/login?audience=business">{t("auth.signIn")}</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/business/register">{t("auth.signUp")}</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

