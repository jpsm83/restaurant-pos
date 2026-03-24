import { describe, expect, it } from "vitest";
import { selectNotificationCounters } from "./selectors";

describe("notification selectors", () => {
  it("computes unread and deleted counters", () => {
    const result = selectNotificationCounters([
      { _id: "1", message: "a", notificationType: "Info", readFlag: false },
      { _id: "2", message: "b", notificationType: "Info", readFlag: true },
      { _id: "3", message: "c", notificationType: "Info", deletedFlag: true },
    ]);

    expect(result.unreadCount).toBe(1);
    expect(result.deletedCount).toBe(1);
  });
});

