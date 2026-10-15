import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip";

describe("Tooltip", () => {
  it("renders trigger inside provider", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Target</TooltipTrigger>
          <TooltipContent>Tip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("Target")).toBeInTheDocument();
  });
});
