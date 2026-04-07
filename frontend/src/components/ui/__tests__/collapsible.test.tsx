import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";

describe("Collapsible", () => {
  it("shows content after trigger is activated", async () => {
    const user = userEvent.setup();
    render(
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden text</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.queryByText("Hidden text")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(await screen.findByText("Hidden text")).toBeInTheDocument();
  });
});
