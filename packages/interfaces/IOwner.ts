import type { Types } from "mongoose";

export interface IOwner {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId;
  /** The single country shared by every Company and Business in this portfolio. */
  country: string;
  /** Subscription pointer for the portfolio; defaults to Free. */
  subscription: string;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
