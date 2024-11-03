import { Types } from "mongoose";

export interface IConfigurationSetupToPrintOrders {
    mainCategory: string;
    subCategories?: string[];
    salesPointIds: Types.ObjectId[];
    excludeEmployeeIds?: Types.ObjectId[];
}

export interface IPrinter {
    printerAlias: string;
    description?: string;
    printerStatus?: string;
    ipAddress: string;
    port: number;
    businessId: Types.ObjectId;
    backupPrinterId?: Types.ObjectId;
    employeesAllowedToPrintDataIds?: Types.ObjectId[];
    configurationSetupToPrintOrders?: IConfigurationSetupToPrintOrders[];
}
