import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableBody } from "../TableBody";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

describe("TableBody", () => {
  it("renders empty state when there are no rows", () => {
    const table = {
      getPaginationRowModel: () => ({ rows: [] }),
    } as never;

    render(<table><TableBody table={table} columns={[{}]} /></table>);

    expect(screen.getByText("No data found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
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
      getPaginationRowModel: () => ({ rows: [row] }),
    } as never;

    render(
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
