import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableHeader } from "../TableHeader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { column?: string }) =>
      key.includes("sortByAriaLabel") ? `Sort by ${vars?.column}` : key,
  }),
}));

describe("TableHeader", () => {
  it("renders sortable header and toggles sorting", async () => {
    const user = userEvent.setup();
    const toggleSorting = vi.fn();
    const table = {
      getHeaderGroups: () => [
        {
          id: "hg1",
          headers: [
            {
              id: "h1",
              isPlaceholder: false,
              column: {
                id: "name",
                getCanSort: () => true,
                getIsSorted: () => false,
                toggleSorting,
                columnDef: { header: "Name" },
              },
              getContext: () => ({}),
            },
          ],
        },
      ],
    } as never;

    render(<table><TableHeader table={table} /></table>);
    await user.click(screen.getByRole("button", { name: "Sort by name" }));
    expect(toggleSorting).toHaveBeenCalledWith(false);
  });
});
