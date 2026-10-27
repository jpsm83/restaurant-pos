import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { TableBody } from "../TableBody";

describe("TableBody", () => {
  it("renders empty state when there are no rows", async () => {
    const table = {
      getPaginatedRowModel: () => ({ rows: [] }),
    } as never;

    await renderWithI18n(
      <table>
        <TableBody table={table} columns={[{}]} />
      </table>,
    );

    expect(screen.getByText("No data found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders the empty state in Spanish", async () => {
    const table = {
      getPaginatedRowModel: () => ({ rows: [] }),
    } as never;

    await renderWithI18n(
      <table>
        <TableBody table={table} columns={[{}]} />
      </table>,
      { language: "es" },
    );

    expect(screen.getByText("No se encontraron datos")).toBeInTheDocument();
    expect(screen.getByText("Intenta ajustar tus filtros")).toBeInTheDocument();
  });

  it("renders rows and triggers onRowClick on double click", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const row = {
      id: "row-1",
      original: { id: 1, name: "A" },
      getVisibleCells: () => [
        {
          id: "c1",
          column: { columnDef: { cell: () => "Cell A" } },
          getContext: () => ({}),
        },
      ],
    };
    const table = {
      getPaginatedRowModel: () => ({ rows: [row] }),
    } as never;

    await renderWithI18n(
      <table>
        <TableBody table={table} columns={[{}]} onRowClick={onRowClick} selectedRowId="row-1" />
      </table>,
    );

    const rowElement = screen.getByText("Cell A").closest("tr");
    expect(rowElement).toHaveAttribute("data-state", "selected");
    await user.dblClick(rowElement!);
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: "A" });
  });
});
