import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerMarketingPage() {
  const { t } = useTranslation("nav");
  const highlights = [
    t("marketing.customer.highlights.explore"),
    t("marketing.customer.highlights.selfOrder"),
    t("marketing.customer.highlights.notifications"),
  ];

  return (
    <main className="marketing flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t("marketing.customer.title")}</CardTitle>
          <CardDescription>{t("marketing.customer.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {t("marketing.customer.footer")}
          </p>
          <Button asChild>
            <a href="/login?audience=customer">{t("auth.signIn")}</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/signup?audience=customer">{t("auth.signUp")}</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

