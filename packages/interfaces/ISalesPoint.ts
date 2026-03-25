import { Types } from "mongoose";

/** Valid values for salesPointType come from salesPointTypeEnums (including "delivery"). */
export interface ISalesPoint {
  salesPointName: string;
  salesPointType?: string;
  selfOrdering: boolean;
  qrCode?: string;
  qrEnabled?: boolean;
  qrLastScanned?: Date;
  businessId: Types.ObjectId;
}
