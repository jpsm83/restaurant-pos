import { Types } from "mongoose";

export interface IConfigurationSetupToPrintOrders {
    mainCategory: string;
    subCategories?: string[];
    salesPointIds: Types.ObjectId[];
    excludeUserIds?: Types.ObjectId[];
}

export interface IPrinter {
    printerAlias: string;
    description?: string;
    printerStatus?: string;
    ipAddress: string;
    port: number;
    businessId: Types.ObjectId;
    backupPrinterId?: Types.ObjectId;
    usersAllowedToPrintDataIds?: Types.ObjectId[];
    configurationSetupToPrintOrders?: IConfigurationSetupToPrintOrders[];
}
