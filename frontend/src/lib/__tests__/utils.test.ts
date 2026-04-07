import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("joins class names from strings, arrays, and conditionals", () => {
    const value = cn(
      "inline-flex",
      ["items-center", false && "hidden"],
      { "font-semibold": true, "opacity-50": false },
    );

    expect(value).toBe("inline-flex items-center font-semibold");
  });

  it("resolves tailwind conflicts with last class winning", () => {
    const value = cn("p-2 text-sm", "p-4", "text-lg");
    expect(value).toBe("p-4 text-lg");
  });
});
