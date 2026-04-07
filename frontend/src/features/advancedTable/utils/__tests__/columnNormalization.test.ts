import { describe, expect, it } from "vitest";
import { normalizeColumns } from "../columnNormalization";

describe("columnNormalization", () => {
  it("keeps valid ids and trims whitespace", () => {
    const result = normalizeColumns([
      { id: " ticket ", header: "Ticket" },
      { id: "", header: "Invalid" },
      { id: "status", header: "Status" },
    ]);

    expect(result).toEqual([
      { id: "ticket", header: "Ticket" },
      { id: "status", header: "Status" },
    ]);
  });
});
