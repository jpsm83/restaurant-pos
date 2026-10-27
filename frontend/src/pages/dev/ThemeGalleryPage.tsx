/**
 * Development-only `/dev/themes` review surface.
 *
 * Renders every registered theme × mode using the real registry and the token
 * contract. The route is registered from `appRoutes.tsx` only when
 * `import.meta.env.DEV` is true, so the page is not part of the production
 * bundle.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle2Icon, PlusIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ResolvedThemeMode } from "@/hooks/useTheme";
import {
  THEME_TOKEN_GROUPS,
  THEME_TOKEN_CONTRACT,
} from "@/styles/theme-contract";
import { THEMES, type ThemeId } from "@/styles/themes";
import "@/styles/dev-gallery.css";

type TokenGroup = keyof typeof THEME_TOKEN_GROUPS;

const MODES: ResolvedThemeMode[] = ["light", "dark"];

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;

const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_BUTTON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

const ALERT_TONES = [
  { tone: "error", key: "alertError" },
  { tone: "success", key: "alertSuccess" },
  { tone: "warning", key: "alertWarning" },
  { tone: "info", key: "alertInfo" },
] as const;

function GallerySection(props: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-gallery-section={props.id}
      aria-label={props.title}
      className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
    >
      <h3 className="font-heading text-lg font-semibold">{props.title}</h3>
      {props.children}
    </section>
  );
}

function TokenSwatches() {
  const { t } = useTranslation("common");

  return (
    <GallerySection
      id="tokens"
      title={t("devThemeGallery.sections.tokens")}
    >
      <div className="space-y-4">
        {(Object.entries(THEME_TOKEN_GROUPS) as [TokenGroup, readonly string[]][]).map(
          ([group, tokens]) => (
            <div key={group} data-token-group={group} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t(`devThemeGallery.tokenGroups.${group}`)}
              </h4>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {tokens.map((token) => (
                  <li key={token} data-token={token} className="space-y-1">
                    <span
                      aria-hidden="true"
                      data-token-swatch={token}
                      className="flex h-8 items-center justify-center rounded-md border border-border text-xs"
                    />
                    <code
                      title={`--${token}`}
                      className="block truncate text-xs text-muted-foreground"
                    >
                      --{token}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </GallerySection>
  );
}

function TypographySample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection
      id="typography"
      title={t("devThemeGallery.sections.typography")}
    >
      <div className="space-y-2">
        <p className="font-heading text-3xl font-semibold tracking-tight">
          {t("devThemeGallery.samples.heading")}
        </p>
        <p className="text-xl font-medium">
          {t("devThemeGallery.samples.subheading")}
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("devThemeGallery.samples.body")}
        </p>
        <code className="inline-block rounded-md bg-muted px-2 py-1 font-mono text-sm text-muted-foreground">
          {t("devThemeGallery.samples.mono")}
        </code>
      </div>
    </GallerySection>
  );
}

function ButtonSample() {
  const { t } = useTranslation("common");
  const label = t("devThemeGallery.samples.button");

  return (
    <GallerySection
      id="buttons"
      title={t("devThemeGallery.sections.buttons")}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              {label}
            </Button>
          ))}
          {ICON_BUTTON_SIZES.map((size) => (
            <Button
              key={size}
              size={size}
              aria-label={t("devThemeGallery.samples.buttonIconLabel")}
            >
              <PlusIcon />
            </Button>
          ))}
        </div>
      </div>
    </GallerySection>
  );
}

function InputSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection
      id="inputs"
      title={t("devThemeGallery.sections.inputs")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="block space-y-1.5">
          <span>{t("devThemeGallery.samples.inputLabel")}</span>
          <Input placeholder={t("devThemeGallery.samples.inputPlaceholder")} />
        </Label>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            {t("devThemeGallery.samples.selectLabel")}
          </p>
          <Select defaultValue="main">
            <SelectTrigger
              className="w-full"
              aria-label={t("devThemeGallery.samples.selectLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">
                {t("devThemeGallery.samples.selectOptionOne")}
              </SelectItem>
              <SelectItem value="terrace">
                {t("devThemeGallery.samples.selectOptionTwo")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          <span>{t("devThemeGallery.samples.checkLabel")}</span>
        </Label>
      </div>
    </GallerySection>
  );
}

function CardSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="card" title={t("devThemeGallery.sections.card")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("devThemeGallery.samples.cardTitle")}</CardTitle>
          <CardDescription>
            {t("devThemeGallery.samples.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("devThemeGallery.samples.cardBody")}
          </p>
          <Button variant="outline">
            {t("devThemeGallery.samples.cardAction")}
          </Button>
        </CardContent>
      </Card>
    </GallerySection>
  );
}

function AlertSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="alert" title={t("devThemeGallery.sections.alert")}>
      <div className="grid gap-2">
        {ALERT_TONES.map(({ tone, key }) => (
          <Alert key={tone} tone={tone}>
            {t(`devThemeGallery.samples.${key}`)}
          </Alert>
        ))}
      </div>
    </GallerySection>
  );
}

function TableSample() {
  const { t, i18n } = useTranslation("common");
  const amountFormat = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <GallerySection id="table" title={t("devThemeGallery.sections.table")}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("devThemeGallery.samples.tableName")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("devThemeGallery.samples.tableStatus")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("devThemeGallery.samples.tableAmount")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2">
                {t("devThemeGallery.samples.tableRowOne")}
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs">
                  {t("devThemeGallery.samples.tableStatusActive")}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {amountFormat.format(42.5)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2">
                {t("devThemeGallery.samples.tableRowTwo")}
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs">
                  {t("devThemeGallery.samples.tableStatusPending")}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {amountFormat.format(18)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GallerySection>
  );
}

function SidebarSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection
      id="sidebar"
      title={t("devThemeGallery.sections.sidebar")}
    >
      <div className="w-full max-w-xs rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <p className="px-2 pb-3 text-sm font-semibold">
          {t("devThemeGallery.samples.sidebarBrand")}
        </p>
        <p className="px-2 pb-1 text-xs text-sidebar-foreground/70">
          {t("devThemeGallery.samples.sidebarGroup")}
        </p>
        <ul className="space-y-1">
          <li>
            <span className="flex h-8 items-center rounded-md bg-sidebar-accent px-2 text-sm font-medium text-sidebar-accent-foreground">
              {t("devThemeGallery.samples.sidebarItemOne")}
            </span>
          </li>
          <li>
            <span className="flex h-8 items-center rounded-md px-2 text-sm text-sidebar-foreground">
              {t("devThemeGallery.samples.sidebarItemTwo")}
            </span>
          </li>
        </ul>
      </div>
    </GallerySection>
  );
}

function DialogSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="dialog" title={t("devThemeGallery.sections.dialog")}>
      <div className="relative min-h-48 overflow-hidden rounded-lg border border-border bg-surface p-4">
        <div aria-hidden="true" className="absolute inset-0 bg-overlay" />
        <div className="relative mx-auto mt-6 max-w-xs rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-overlay">
          <h4 className="font-heading text-base font-semibold">
            {t("devThemeGallery.samples.dialogTitle")}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("devThemeGallery.samples.dialogDescription")}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline">
              {t("devThemeGallery.samples.dialogCancel")}
            </Button>
            <Button>{t("devThemeGallery.samples.dialogConfirm")}</Button>
          </div>
        </div>
      </div>
    </GallerySection>
  );
}

function ToastSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="toast" title={t("devThemeGallery.sections.toast")}>
      <div className="max-w-sm rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-overlay">
        <div className="flex items-start gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 text-success" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("devThemeGallery.samples.toastTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("devThemeGallery.samples.toastDescription")}
            </p>
          </div>
        </div>
      </div>
    </GallerySection>
  );
}

function FocusSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="focus" title={t("devThemeGallery.sections.focus")}>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="border-ring ring-3 ring-ring/50">
          {t("devThemeGallery.samples.focusLabel")}
        </Button>
        <Input
          aria-label={t("devThemeGallery.samples.focusLabel")}
          className="max-w-56 border-ring ring-3 ring-ring/50"
          defaultValue={t("devThemeGallery.samples.focusLabel")}
        />
      </div>
    </GallerySection>
  );
}

function ChartSample() {
  const { t } = useTranslation("common");

  return (
    <GallerySection id="charts" title={t("devThemeGallery.sections.charts")}>
      <div className="space-y-3">
        <p className="text-sm font-medium">
          {t("devThemeGallery.samples.chartTitle")}
        </p>
        <div
          className="flex h-32 items-end gap-2"
          role="img"
          aria-label={t("devThemeGallery.samples.chartTitle")}
        >
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-20 w-full rounded-t-md bg-chart-1" />
            <span className="text-xs text-muted-foreground">--chart-1</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-14 w-full rounded-t-md bg-chart-2" />
            <span className="text-xs text-muted-foreground">--chart-2</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-24 w-full rounded-t-md bg-chart-3" />
            <span className="text-xs text-muted-foreground">--chart-3</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-16 w-full rounded-t-md bg-chart-4" />
            <span className="text-xs text-muted-foreground">--chart-4</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-28 w-full rounded-t-md bg-chart-5" />
            <span className="text-xs text-muted-foreground">--chart-5</span>
          </div>
        </div>
      </div>
    </GallerySection>
  );
}

function ThemePanel(props: {
  themeId: ThemeId;
  mode: ResolvedThemeMode;
}) {
  const { t } = useTranslation("common");
  const themeLabel = t(`devThemeGallery.themes.${props.themeId}`);

  return (
    <article
      data-testid={`theme-panel-${props.themeId}-${props.mode}`}
      data-theme={props.themeId}
      data-mode={props.mode}
      className={cn(
        "space-y-4 rounded-xl border border-border bg-background p-4 text-foreground shadow-panel",
        props.mode === "dark" && "dark",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">
          {t("devThemeGallery.panelTitle", {
            theme: themeLabel,
            mode: t(`devThemeGallery.modes.${props.mode}`),
          })}
        </h2>
        <code className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          data-theme=&quot;{props.themeId}&quot;{props.mode === "dark" ? " .dark" : ""}
        </code>
      </header>

      <TokenSwatches />
      <TypographySample />
      <ButtonSample />
      <InputSample />
      <CardSample />
      <AlertSample />
      <TableSample />
      <SidebarSample />
      <DialogSample />
      <ToastSample />
      <FocusSample />
      <ChartSample />
    </article>
  );
}

export default function ThemeGalleryPage() {
  const { t } = useTranslation("common");

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {t("devThemeGallery.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("devThemeGallery.description")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("devThemeGallery.tokenSummary", {
              count: THEMES.length,
              tokens: THEME_TOKEN_CONTRACT.length,
              themes: THEMES.length,
              modes: MODES.length,
            })}
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          {THEMES.flatMap((theme) =>
            MODES.map((mode) => (
              <ThemePanel
                key={`${theme.id}-${mode}`}
                themeId={theme.id}
                mode={mode}
              />
            )),
          )}
        </div>
      </div>
    </main>
  );
}
