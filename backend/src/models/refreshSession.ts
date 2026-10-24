/**
 * Refresh session — one stored issuance for a User or a Business.
 *
 * The httpOnly refresh cookie identifies this row. `refreshSessionVersion` is
 * the account generation copied at issuance; a later move refuses the session.
 */

import mongoose, { Schema, model } from "mongoose";

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
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
});

const RefreshSession =
  mongoose.models.RefreshSession || model("RefreshSession", refreshSessionSchema);

export default RefreshSession;
