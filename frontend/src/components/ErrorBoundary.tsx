import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import i18n from "@/i18n/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

/** Root-level catch for render errors (Phase 5.1.2). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const t = (key: string) => i18n.t(key, { ns: "errors" });
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mb-4 flex justify-center">
                  <TriangleAlert className="h-16 w-16 text-destructive" aria-hidden />
                </div>
                <CardTitle className="text-2xl">{t("boundary.title")}</CardTitle>
                <CardDescription className="mt-2 text-base">
                  {t("boundary.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {import.meta.env.DEV && this.state.error ? (
                  <pre className="max-h-40 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-left text-xs text-neutral-800">
                    {this.state.error.message}
                  </pre>
                ) : null}
                <Button type="button" className="w-full" onClick={() => window.location.reload()}>
                  {t("boundary.reload")}
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">{t("navigation.home")}</Link>
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
