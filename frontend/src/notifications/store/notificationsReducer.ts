import type { NotificationCreatedLiveMessage, NotificationItem, NotificationState } from "../types";

export type NotificationsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; payload: { items: NotificationItem[]; page: number; limit: number } }
  | { type: "LOAD_ERROR"; payload: string }
  | { type: "LIVE_CREATED"; payload: NotificationCreatedLiveMessage["data"] }
  | { type: "LIVE_CREATED_BATCH"; payload: NotificationCreatedLiveMessage["data"][] }
  | { type: "RESET" };

export const initialNotificationsState: NotificationState = {
  items: [],
  byId: {},
  page: 1,
  limit: 20,
  loading: false,
  error: null,
};

const upsertNotifications = (
  currentById: Record<string, NotificationItem>,
  incoming: NotificationItem[]
): Record<string, NotificationItem> => {
  const next = { ...currentById };
  for (const item of incoming) {
    next[item._id] = item;
  }
  return next;
};

const toSortedItems = (byId: Record<string, NotificationItem>): NotificationItem[] =>
  Object.values(byId).sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

export const notificationsReducer = (
  state: NotificationState,
  action: NotificationsAction
): NotificationState => {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS": {
      const nextById = upsertNotifications(state.byId, action.payload.items);
      return {
        ...state,
        loading: false,
        error: null,
        page: action.payload.page,
        limit: action.payload.limit,
        byId: nextById,
        items: toSortedItems(nextById),
      };
    }
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "LIVE_CREATED": {
      const liveItem: NotificationItem = {
        _id: action.payload.notificationId,
        businessId: action.payload.businessId,
        message: action.payload.message,
        notificationType: action.payload.notificationType,
        readFlag: false,
        deletedFlag: false,
        createdAt: new Date().toISOString(),
      };
      const nextById = upsertNotifications(state.byId, [liveItem]);
      return { ...state, byId: nextById, items: toSortedItems(nextById) };
    }
    case "LIVE_CREATED_BATCH": {
      if (action.payload.length === 0) return state;
      const batchItems: NotificationItem[] = action.payload.map((entry) => ({
        _id: entry.notificationId,
        businessId: entry.businessId,
        message: entry.message,
        notificationType: entry.notificationType,
        readFlag: false,
        deletedFlag: false,
        createdAt: new Date().toISOString(),
      }));
      const nextById = upsertNotifications(state.byId, batchItems);
      return { ...state, byId: nextById, items: toSortedItems(nextById) };
    }
    case "RESET":
      return initialNotificationsState;
    default:
      return state;
  }
};

