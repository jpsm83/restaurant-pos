import { Types } from "mongoose";

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
   * Idempotency key provided by the front-end for customer self-order/delivery payment acceptance.
   * Used to prevent duplicate SalesInstances when payment is retried.
   */
  paymentId?: string;
  salesGroup?: ISalesGroup[];
  closedByUserId?: Types.ObjectId;
}
