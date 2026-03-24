import { describe, expect, it } from "vitest";
import {
  initialNotificationsState,
  notificationsReducer,
} from "./notificationsReducer";

describe("notificationsReducer", () => {
  it("deduplicates by notificationId between REST and live events", () => {
    const afterLoad = notificationsReducer(initialNotificationsState, {
      type: "LOAD_SUCCESS",
      payload: {
        page: 1,
        limit: 20,
        items: [
          {
            _id: "notif-1",
            message: "Initial message",
            notificationType: "Info",
            businessId: "biz-1",
            createdAt: "2026-01-01T10:00:00.000Z",
          },
        ],
      },
    });

    const afterLiveDuplicate = notificationsReducer(afterLoad, {
      type: "LIVE_CREATED",
      payload: {
        notificationId: "notif-1",
        message: "Updated live message",
        notificationType: "Info",
        businessId: "biz-1",
        correlationId: "corr-1",
      },
    });

    expect(afterLiveDuplicate.items).toHaveLength(1);
    expect(afterLiveDuplicate.byId["notif-1"].message).toBe("Updated live message");
  });

  it("keeps newest notifications first", () => {
    const withOlder = notificationsReducer(initialNotificationsState, {
      type: "LOAD_SUCCESS",
      payload: {
        page: 1,
        limit: 20,
        items: [
          {
            _id: "older",
            message: "Older",
            notificationType: "Info",
            createdAt: "2026-01-01T09:00:00.000Z",
          },
        ],
      },
    });

    const withNewer = notificationsReducer(withOlder, {
      type: "LIVE_CREATED",
      payload: {
        notificationId: "newer",
        message: "Newer",
        notificationType: "Info",
        businessId: "biz-1",
        correlationId: "corr-2",
      },
    });

    expect(withNewer.items[0]._id).toBe("newer");
  });

  it("applies batch live updates without duplicates", () => {
    const next = notificationsReducer(initialNotificationsState, {
      type: "LIVE_CREATED_BATCH",
      payload: [
        {
          notificationId: "n1",
          message: "m1",
          notificationType: "Info",
          businessId: "b1",
          correlationId: "c1",
        },
        {
          notificationId: "n1",
          message: "m1-updated",
          notificationType: "Info",
          businessId: "b1",
          correlationId: "c2",
        },
      ],
    });

    expect(next.items).toHaveLength(1);
    expect(next.byId.n1.message).toBe("m1-updated");
  });
});

