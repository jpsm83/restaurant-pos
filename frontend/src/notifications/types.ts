export interface NotificationItem {
  _id: string;
  notificationType: string;
  message: string;
  businessId?: string;
  readFlag?: boolean;
  deletedFlag?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationCreatedLiveMessage {
  type: "notification.created";
  data: {
    notificationId: string;
    businessId: string;
    message: string;
    notificationType: string;
    correlationId: string;
  };
}

export interface NotificationLiveConnectedMessage {
  type: "notification.live.connected";
  data: {
    userId: string;
  };
}

export type NotificationLiveMessage =
  | NotificationCreatedLiveMessage
  | NotificationLiveConnectedMessage;

export interface NotificationState {
  items: NotificationItem[];
  byId: Record<string, NotificationItem>;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
}

