import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThemeGalleryPage from "@/pages/dev/ThemeGalleryPage";
import { registerThemeGalleryResources } from "@/pages/dev/themeGalleryResources";
import { THEME_TOKEN_CONTRACT } from "@/styles/theme-contract";
import { THEMES } from "@/styles/themes";
import { createTestI18n, renderWithI18n } from "@/test/i18nTestUtils";

const REQUIRED_SECTIONS = [
  "Token swatches",
  "Typography",
  "Buttons",
  "Inputs, select, and checkbox",
  "Card",
  "Alert",
  "Table",
  "Sidebar sample",
  "Dialog and overlay",
  "Toast sample",
  "Focus states",
  "Charts",
];

const REQUIRED_GROUPS = [
  "Surfaces",
  "Brand",
  "Muted",
  "States",
  "Borders and focus",
  "Charts",
  "Sidebar",
  "Shape and type",
  "Elevation and layout",
  "Motion",
  "Z-index",
];

describe("ThemeGalleryPage", () => {
  it("renders default light and dark panels with every token group and gallery section", async () => {
    const i18n = await createTestI18n();
    registerThemeGalleryResources(i18n);

    await renderWithI18n(<ThemeGalleryPage />, { i18n });

    expect(
      screen.getByRole("heading", { level: 1, name: "Theme gallery" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 registered theme × 2 modes/)).toBeInTheDocument();

    expect(screen.getAllByTestId(/^theme-panel-/)).toHaveLength(
      THEMES.length * 2,
    );

    for (const mode of ["light", "dark"] as const) {
      const panel = screen.getByTestId(`theme-panel-default-${mode}`);
      const modeLabel = mode === "dark" ? "Dark" : "Light";
      const headingNames = within(panel)
        .getAllByRole("heading")
        .map((heading) => heading.textContent);
      const panelText = panel.textContent ?? "";

      expect(headingNames).toContain(`Default · ${modeLabel}`);
      for (const section of REQUIRED_SECTIONS) {
        expect(headingNames).toContain(section);
      }
      for (const group of REQUIRED_GROUPS) {
        expect(headingNames).toContain(group);
      }
      for (const token of THEME_TOKEN_CONTRACT) {
        expect(panelText).toContain(`--${token}`);
      }
    }
  });

  it("renders translated panel and section copy", async () => {
    const i18n = await createTestI18n();
    registerThemeGalleryResources(i18n);
    await i18n.changeLanguage("es");

    await renderWithI18n(<ThemeGalleryPage />, { i18n });

    expect(
      screen.getByRole("heading", { level: 1, name: "Galería de temas" }),
    ).toBeInTheDocument();

    expect(
      within(screen.getByTestId("theme-panel-default-light")).getByRole(
        "heading",
        { level: 2, name: "Predeterminado · Claro" },
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("theme-panel-default-dark")).getByRole(
        "heading",
        { level: 2, name: "Predeterminado · Oscuro" },
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("theme-panel-default-light")).getByRole(
        "heading",
        { level: 3, name: "Tipografía" },
      ),
    ).toBeInTheDocument();
  });
});
