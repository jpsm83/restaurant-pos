/**
 * Refresh session — one stored issuance for a User or a Business.
 *
 * The httpOnly refresh cookie identifies this row. `refreshSessionVersion` is
 * the account generation copied at issuance; a later move refuses the session.
 */

import mongoose, { Schema, model } from "mongoose";
import * as enums from "restaurant-pos-packages/enums";

const { authModeEnums } = enums;

const refreshSessionSchema = new Schema({
  accountId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  accountType: {
    type: String,
    required: true,
    enum: ["user", "business"],
  },
  /** Copy of the account `refreshSessionVersion` at issuance. */
  refreshSessionVersion: {
    type: Number,
    required: true,
  },
  /** Active Customer | Business mode for this session; Customer by default. */
  mode: {
    type: String,
    enum: authModeEnums,
    default: "customer",
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
});

/**
 * Session rows are transient state, not domain documents (ADR-0003 amendment).
 * MongoDB removes each row once its expiry passes, so expired and revoked
 * sessions do not accumulate.
 */
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshSession =
  mongoose.models.RefreshSession || model("RefreshSession", refreshSessionSchema);

export default RefreshSession;
