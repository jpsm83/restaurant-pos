import type { Types } from "mongoose";
import type { IAddress } from "./IAddress.ts";

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

/** One venue in the Owner portfolio read, with its draft completeness signal. */
export interface IOwnerPortfolioBusiness {
  _id: string;
  tradeName: string;
  currencyTrade: string;
  companyId: string;
  /** Identity/contact profile and Company tax identity are present; not live status. */
  profileComplete: boolean;
  imageUrl?: string;
  address?: Partial<IAddress>;
}

/** One Company in the Owner portfolio read and the venues it owns. */
export interface IOwnerPortfolioCompany {
  _id: string;
  country: string;
  businesses: IOwnerPortfolioBusiness[];
  legalName?: string;
  taxNumber?: string;
}

/**
 * The signed-in User's portfolio. `owner` is `null` when the caller owns no
 * venue; the flat `country`/`subscription` fields mirror the Owner for callers
 * that do not need the nested object.
 */
export interface IOwnerPortfolio {
  owner: Pick<IOwner, "country" | "subscription"> & { _id: string } | null;
  country: string | null;
  subscription: string | null;
  companies: IOwnerPortfolioCompany[];
}
