/**
 * Address DTO — the address payload shared by every entity that owns one
 * (businesses, suppliers, personal details).
 *
 * The repository's `IAddress`/address model is the domain shape: six required
 * location fields plus optional extras. Strict (unknown keys rejected) so a
 * client that sends a stray key gets a `400`. Consumed as a JSON-encoded field
 * over multipart (wrap with `jsonField`).
 */
import { z } from "zod";

import { coercedNumberSchema, sanitizedString } from "./primitives.ts";

export const addressSchema = z.strictObject({
  country: sanitizedString("Country is required!"),
  state: sanitizedString("State is required!"),
  city: sanitizedString("City is required!"),
  street: sanitizedString("Street is required!"),
  buildingNumber: sanitizedString("Building number is required!"),
  postCode: sanitizedString("Postcode is required!"),
  doorNumber: sanitizedString().optional(),
  complement: sanitizedString().optional(),
  region: sanitizedString().optional(),
  additionalDetails: sanitizedString().optional(),
  coordinates: z.array(coercedNumberSchema).optional(),
});

export type Address = z.infer<typeof addressSchema>;
