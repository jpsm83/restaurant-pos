/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { useAuth, getAccessToken } from "@/auth";
import { fetchUserNotifications } from "../api";
import {
  buildNotificationsLiveUrlWithToken,
  getReconnectDelayMs,
  parseNotificationsLiveMessage,
} from "../live";
import {
  initialNotificationsState,
  notificationsReducer,
  type NotificationsAction,
} from "./notificationsReducer";
import type { NotificationCreatedLiveMessage, NotificationState } from "../types";

interface NotificationsContextValue {
  state: NotificationState;
  dispatch: Dispatch<NotificationsAction>;
  loadPage: (params?: { page?: number; limit?: number }) => Promise<void>;
  applyLiveCreated: (payload: NotificationCreatedLiveMessage["data"]) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationsReducer, initialNotificationsState);
  const { state: authState } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const liveQueueRef = useRef<NotificationCreatedLiveMessage["data"][]>([]);
  const liveFlushRafRef = useRef<number | null>(null);

  const loadPage = useCallback(
    async (params?: { page?: number; limit?: number }) => {
      const userId = authState.user?.id;
      const accessToken = getAccessToken();
      if (!userId || !accessToken) {
        dispatch({ type: "RESET" });
        return;
      }

      dispatch({ type: "LOAD_START" });
      const page = params?.page ?? state.page;
      const limit = params?.limit ?? state.limit;
      const result = await fetchUserNotifications(userId, accessToken, { page, limit });
      if (!result.ok) {
        dispatch({ type: "LOAD_ERROR", payload: result.error });
        return;
      }
      dispatch({ type: "LOAD_SUCCESS", payload: { items: result.data, page, limit } });
    },
    [authState.user?.id, state.page, state.limit]
  );

  const applyLiveCreated = useCallback(
    (payload: NotificationCreatedLiveMessage["data"]) => {
      liveQueueRef.current.push(payload);
      if (liveFlushRafRef.current !== null) return;

      liveFlushRafRef.current = window.requestAnimationFrame(() => {
        const batch = liveQueueRef.current;
        liveQueueRef.current = [];
        liveFlushRafRef.current = null;
        if (batch.length === 1) {
          dispatch({ type: "LIVE_CREATED", payload: batch[0] });
          return;
        }
        dispatch({ type: "LIVE_CREATED_BATCH", payload: batch });
      });
    },
    []
  );

  useEffect(() => {
    const bootstrapNotifications = async () => {
      const userId = authState.user?.id;
      const accessToken = getAccessToken();
      if (!userId || !accessToken) {
        dispatch({ type: "RESET" });
        return;
      }

      dispatch({ type: "LOAD_START" });
      const result = await fetchUserNotifications(userId, accessToken, {
        page: 1,
        limit: initialNotificationsState.limit,
      });
      if (!result.ok) {
        dispatch({ type: "LOAD_ERROR", payload: result.error });
        return;
      }
      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          items: result.data,
          page: 1,
          limit: initialNotificationsState.limit,
        },
      });
    };

    void bootstrapNotifications();
  }, [authState.user?.id]);

  useEffect(() => {
    const userId = authState.user?.id;
    const accessToken = getAccessToken();

    if (!userId || !accessToken) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (liveFlushRafRef.current !== null) {
        window.cancelAnimationFrame(liveFlushRafRef.current);
        liveFlushRafRef.current = null;
      }
      liveQueueRef.current = [];
      reconnectAttemptRef.current = 0;
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const socket = new WebSocket(buildNotificationsLiveUrlWithToken(accessToken));
      socketRef.current = socket;

      socket.onopen = () => {
        const wasReconnect = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;
        if (wasReconnect) {
          void loadPage({ page: 1, limit: state.limit });
        }
      };

      socket.onmessage = (event) => {
        const parsed = parseNotificationsLiveMessage(String(event.data));
        if (!parsed) return;
        if (parsed.type === "notification.created") {
          applyLiveCreated(parsed.data);
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        const delay = getReconnectDelayMs(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (liveFlushRafRef.current !== null) {
        window.cancelAnimationFrame(liveFlushRafRef.current);
        liveFlushRafRef.current = null;
      }
      liveQueueRef.current = [];
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [authState.user?.id, applyLiveCreated, loadPage, state.limit]);

  const value = useMemo(
    () => ({ state, dispatch, loadPage, applyLiveCreated }),
    [state, loadPage, applyLiveCreated]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationsProvider");
  }
  return context;
}

