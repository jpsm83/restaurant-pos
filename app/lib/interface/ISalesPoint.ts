import { Types } from "mongoose";

export interface ISalesPoint {
  salesPointName: string;
  salesPointType?: string;
  selfOrdering: boolean;
  qrCode?: string;
  qrEnabled?: boolean;
  qrLastScanned?: Date;
  businessId: Types.ObjectId;
}
