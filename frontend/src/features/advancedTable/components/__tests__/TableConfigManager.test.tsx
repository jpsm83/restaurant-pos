import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { shouldDisableSave, TableConfigManager } from "../TableConfigManager";

const mockUseTableConfigData = vi.fn();

vi.mock("@/features/advancedTable/hooks/useTableConfigData", () => ({
  useTableConfigData: (...args: unknown[]) => mockUseTableConfigData(...args),
}));

vi.mock("@/features/advancedTable/components/TableConfigEditor", () => ({
  TableConfigEditor: () => <div>editor-mock</div>,
}));

describe("TableConfigManager", () => {
  it("evaluates shouldDisableSave helper", () => {
    expect(shouldDisableSave(true, false, [])).toBe(true);
    expect(shouldDisableSave(false, false, [])).toBe(true);
    expect(
      shouldDisableSave(false, false, [
        { columnKey: "id", columnName: "ID", order: 0, enable: true, visible: true },
      ]),
    ).toBe(false);
  });

  it("renders empty columns helper message when there is nothing to save", async () => {
    mockUseTableConfigData.mockReturnValue({
      columns: [],
      isLoading: false,
      isSaving: false,
      error: null,
      save: vi.fn(),
    });

    await renderWithI18n(
      <TableConfigManager endpoint={{ loadUrl: "/load", saveUrl: "/save" }} />,
    );

    expect(screen.getByText("editor-mock")).toBeInTheDocument();
    expect(screen.getByText("No columns available to save.")).toBeInTheDocument();
  });

  it("resolves a table-layout load failure to localized copy", async () => {
    mockUseTableConfigData.mockReturnValue({
      columns: [
        { columnKey: "id", columnName: "ID", order: 0, enable: true, visible: true },
      ],
      isLoading: false,
      isSaving: false,
      error: { code: "tableConfigLoad.transport" },
      save: vi.fn(),
    });

    await renderWithI18n(
      <TableConfigManager endpoint={{ loadUrl: "/load", saveUrl: "/save" }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not reach the server. Check your connection and try again.",
    );
  });

  it("resolves a table-layout save failure to Spanish copy", async () => {
    mockUseTableConfigData.mockReturnValue({
      columns: [
        { columnKey: "id", columnName: "ID", order: 0, enable: true, visible: true },
      ],
      isLoading: false,
      isSaving: false,
      error: { code: "tableConfigSave.forbidden" },
      save: vi.fn(),
    });

    await renderWithI18n(
      <TableConfigManager endpoint={{ loadUrl: "/load", saveUrl: "/save" }} />,
      { language: "es" },
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No tienes permiso para hacer eso.",
    );
  });
});
