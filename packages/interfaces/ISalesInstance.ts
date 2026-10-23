import type { Types } from "mongoose";

export interface ISalesGroup {
  orderCode: string;
  ordersIds: Types.ObjectId[];
}

export interface ISalesInstance {
  _id?: Types.ObjectId;
  dailyReferenceNumber?: number;
  salesPointId: Types.ObjectId;
  guests: number;
  salesInstanceStatus: string;
  reservationId?: Types.ObjectId;
  openedByUserId?: Types.ObjectId;
  openedAsRole?: "employee" | "customer";
  responsibleByUserId?: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  /**
   * Idempotency key for customer self-order and delivery payment acceptance.
   * Unique across active and soft-deleted sittings so a retry cannot open another.
   */
  paymentId?: string;
  salesGroup?: ISalesGroup[];
  closedByUserId?: Types.ObjectId;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
