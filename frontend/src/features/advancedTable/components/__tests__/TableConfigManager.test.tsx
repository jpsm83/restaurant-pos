import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { shouldDisableSave, TableConfigManager } from "../TableConfigManager";

const mockUseTableConfigData = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

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

  it("renders empty columns helper message when there is nothing to save", () => {
    mockUseTableConfigData.mockReturnValue({
      columns: [],
      isLoading: false,
      isSaving: false,
      error: null,
      save: vi.fn(),
    });

    render(<TableConfigManager endpoint={{ loadUrl: "/load", saveUrl: "/save" }} />);

    expect(screen.getByText("editor-mock")).toBeInTheDocument();
    expect(screen.getByText("No columns available to save.")).toBeInTheDocument();
  });
});
