import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderWithI18n } from "@/test/i18nTestUtils";

describe("ui/select", () => {
  it("renders trigger and supports keyboard focus", async () => {
    const user = userEvent.setup();

    await renderWithI18n(
      <Select>
        <SelectTrigger aria-label="Quick range">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lastHour">Last hour</SelectItem>
          <SelectItem value="today">Today</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.tab();
    const trigger = screen.getByRole("combobox", { name: "Quick range" });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
