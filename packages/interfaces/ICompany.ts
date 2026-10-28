import type { Types } from "mongoose";

export interface ICompany {
  _id?: Types.ObjectId | string;
  /** The Owner that owns this tax entity. */
  ownerId: Types.ObjectId;
  /** Inherited from the owning Owner's portfolio country. */
  country: string;
  /** Optional while the Company is a draft. */
  legalName?: string;
  /** Optional while the Company is a draft. */
  taxNumber?: string;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
