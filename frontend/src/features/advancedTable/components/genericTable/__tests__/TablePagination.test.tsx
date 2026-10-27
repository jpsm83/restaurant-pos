import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { TablePagination } from "../TablePagination";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("TablePagination", () => {
  it("renders pagination info and invokes clear filters", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const table = {
      getFilteredSelectedRowModel: () => ({ rows: [{}, {}] }),
      getFilteredRowModel: () => ({ rows: [{}, {}, {}] }),
      getCanPreviousPage: () => false,
      getCanNextPage: () => true,
      setPageIndex: vi.fn(),
      previousPage: vi.fn(),
      nextPage: vi.fn(),
      state: { pagination: { pageIndex: 0, pageSize: 25 } },
      getPageCount: () => 3,
      setPageSize: vi.fn(),
      getAllColumns: () => [],
    } as never;

    await renderWithI18n(
      <TablePagination table={table} onClearFilters={onClearFilters} />,
    );

    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("renders pagination controls in Spanish", async () => {
    const table = {
      getFilteredSelectedRowModel: () => ({ rows: [{}] }),
      getFilteredRowModel: () => ({ rows: [{}, {}] }),
      getCanPreviousPage: () => true,
      getCanNextPage: () => true,
      setPageIndex: vi.fn(),
      previousPage: vi.fn(),
      nextPage: vi.fn(),
      state: { pagination: { pageIndex: 0, pageSize: 25 } },
      getPageCount: () => 2,
      setPageSize: vi.fn(),
      getAllColumns: () => [],
    } as never;

    await renderWithI18n(<TablePagination table={table} />, { language: "es" });

    expect(screen.getByText("1 de 2 seleccionados")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir a la primera página" }),
    ).toBeInTheDocument();
  });
});
