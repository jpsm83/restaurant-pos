import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableFilterRow } from "../TableFilterRow";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

describe("TableFilterRow", () => {
  it("renders input filter and applies filter on Enter for non-realtime columns", async () => {
    const setFilterValue = vi.fn();
    const table = {
      getHeaderGroups: () => [
        {
          headers: [
            {
              isPlaceholder: false,
              column: {
                id: "name",
                getCanFilter: () => true,
                setFilterValue,
              },
            },
          ],
        },
      ],
    } as never;

    const setFilterInputs = vi.fn((updater) => updater({}));
    render(
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

    const input = screen.getByRole("textbox", { name: "Filter name" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });
    expect(setFilterValue).toHaveBeenCalledWith("abc");
    expect(setFilterInputs).not.toHaveBeenCalled();
  });
});
