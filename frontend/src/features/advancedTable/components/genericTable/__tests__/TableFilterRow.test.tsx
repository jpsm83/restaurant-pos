import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { TableFilterRow } from "../TableFilterRow";

function createTable(columnId = "name", label = "Name") {
  const setFilterValue = vi.fn();
  const table = {
    getHeaderGroups: () => [
      {
        headers: [
          {
            isPlaceholder: false,
            column: {
              id: columnId,
              columnDef: { meta: { label } },
              getCanFilter: () => true,
              setFilterValue,
            },
          },
        ],
      },
    ],
  } as never;
  return { table, setFilterValue };
}

describe("TableFilterRow", () => {
  it("renders input filter with the column display label and applies on Enter", async () => {
    const { table, setFilterValue } = createTable("name", "Name");

    const setFilterInputs = vi.fn((updater) => updater({}));
    await renderWithI18n(
      <table>
        <tbody>
          <TableFilterRow
            table={table}
            setFilterInputs={setFilterInputs}
            getFilterValue={() => "abc"}
            isRealtimeFilterColumn={() => false}
          />
        </tbody>
      </table>,
    );

    const input = screen.getByRole("textbox", { name: "Filter Name" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });
    expect(setFilterValue).toHaveBeenCalledWith("abc");
    expect(setFilterInputs).not.toHaveBeenCalled();
  });

  it("localizes the filter aria label and placeholders in Spanish", async () => {
    const { table } = createTable("status", "Estado");

    await renderWithI18n(
      <table>
        <tbody>
          <TableFilterRow table={table} isRealtimeFilterColumn={() => true} />
        </tbody>
      </table>,
      { language: "es" },
    );

    const input = screen.getByRole("textbox", { name: "Filtrar Estado" });
    expect(input).toHaveAttribute("placeholder", "Escribe para filtrar");
  });
});
