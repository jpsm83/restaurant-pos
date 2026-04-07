import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TablePagination } from "../TablePagination";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; page?: number; totalPages?: number; selected?: number; total?: number }) =>
      opts?.defaultValue
        ?.replace("{{page}}", String(opts.page ?? ""))
        .replace("{{totalPages}}", String(opts.totalPages ?? ""))
        .replace("{{selected}}", String(opts.selected ?? ""))
        .replace("{{total}}", String(opts.total ?? "")) ?? _key,
  }),
}));

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
      getState: () => ({ pagination: { pageIndex: 0, pageSize: 25 } }),
      getPageCount: () => 3,
      setPageSize: vi.fn(),
      getAllColumns: () => [],
    } as never;

    render(<TablePagination table={table} onClearFilters={onClearFilters} />);

    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
