import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { getPostLoginDestination } from "@/auth/postLoginRedirect";
import { useAuth } from "@/auth/store/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Client-side guard outcome: wrong account type for the route, or other forbidden UI (Phase 2.3). */
export default function AccessDenied() {
  const { t } = useTranslation("errors");
  const navigate = useNavigate();
  const { state } = useAuth();

  const canOpenWorkspace =
    state.status === "authenticated" && state.user !== null;

  const handleOpenWorkspace = () => {
    if (state.user) {
      navigate(getPostLoginDestination(state.user), { replace: true });
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <TriangleAlert className="h-16 w-16 text-destructive" aria-hidden />
            </div>
            <CardTitle className="text-2xl">{t("accessDenied.title")}</CardTitle>
            <CardDescription className="mt-2 text-base">
              {t("accessDenied.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {canOpenWorkspace ? (
              <Button type="button" onClick={handleOpenWorkspace} className="w-full">
                {t("accessDenied.openWorkspace")}
              </Button>
            ) : null}
            <Button asChild variant="outline" className="w-full">
              <Link to="/">{t("navigation.home")}</Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="w-full">
              {t("navigation.goBack")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
