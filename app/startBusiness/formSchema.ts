import { z } from "zod";

export const formSchema = z.object({
    tradeName: z.string().min(5, {message: "Trade name must be at least 5 characters.",}).max(50),
    legalName: z.string().min(5, {message: "Legal name must be at least 5 characters.",}).max(50),
    email: z.string().email(),
    password: z.string().min(8, {message: "Password must be at least 8 characters.",}),
    phoneNumber: z.string().min(10, {message: "Phone number must be at least 10 characters.",}).max(10),
    taxNumber: z.string().min(10, {message: "Tax number must be at least 10 characters.",}).max(10),
    currencyTrade: z.string(),
    subscription: z.string(),
    address: z.object({
        country: z.string(),
        state: z.string(),
        city: z.string(),
        street: z.string(),
        buildingNumber: z.string(),
        postCode: z.string(),
        region: z.string().optional(),
        additionalDetails: z.string().optional(),
        coordinates: z.array(z.number()).optional(),
    }),
    contactPerson: z.string().min(4, {message: "Contact person must be at least 4 characters.",}).max(50),
});