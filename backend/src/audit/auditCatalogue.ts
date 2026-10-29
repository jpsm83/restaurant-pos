/**
 * One catalogue for audit actors, targets, acts, and parent retention classes.
 * Later audited acts extend these constants rather than passing loose strings.
 */
export const AUDIT_ACTOR_KINDS = {
  USER: "user",
  BUSINESS: "business",
  SYSTEM: "system",
} as const;

export type AuditActorKind =
  (typeof AUDIT_ACTOR_KINDS)[keyof typeof AUDIT_ACTOR_KINDS];

export const AUDIT_TARGET_KINDS = {
  BUSINESS: "Business",
  USER: "User",
  PURCHASE: "Purchase",
  PURCHASE_LINE: "PurchaseLine",
  INVENTORY: "Inventory",
  INVENTORY_COUNT: "InventoryCount",
  SUPPLIER_GOOD: "SupplierGood",
  SALES_INSTANCE: "SalesInstance",
  ORDER: "Order",
} as const;

export type AuditTargetKind =
  (typeof AUDIT_TARGET_KINDS)[keyof typeof AUDIT_TARGET_KINDS];

export const AUDIT_ACT_KINDS = {
  EMAIL_CHANGE_REQUESTED: "emailChange.requested",
  PURCHASE_LINE_EDITED: "purchase.lineEdited",
  INVENTORY_COUNT_REEDITED: "inventory.countReedited",
  ORDER_VOIDED: "order.voided",
  ORDER_INVITED: "order.invited",
} as const;

export type AuditActKind =
  (typeof AUDIT_ACT_KINDS)[keyof typeof AUDIT_ACT_KINDS];

export const AUDIT_RETENTION_CLASSES = {
  OPERATIONAL: "operational",
  LEGAL_AND_FINANCIAL: "legalAndFinancial",
} as const;

export type AuditRetentionClass =
  (typeof AUDIT_RETENTION_CLASSES)[keyof typeof AUDIT_RETENTION_CLASSES];

/**
 * The primary target is the parent record; its kind decides the retention
 * class. Audit does not invent a third class (see ADR-0003 amendment).
 */
export const AUDIT_TARGET_RETENTION_CLASSES: Record<
  AuditTargetKind,
  AuditRetentionClass
> = {
  [AUDIT_TARGET_KINDS.BUSINESS]: AUDIT_RETENTION_CLASSES.OPERATIONAL,
  [AUDIT_TARGET_KINDS.USER]: AUDIT_RETENTION_CLASSES.OPERATIONAL,
  [AUDIT_TARGET_KINDS.PURCHASE]: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
  [AUDIT_TARGET_KINDS.PURCHASE_LINE]:
    AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
  [AUDIT_TARGET_KINDS.INVENTORY]: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
  [AUDIT_TARGET_KINDS.INVENTORY_COUNT]:
    AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
  [AUDIT_TARGET_KINDS.SUPPLIER_GOOD]: AUDIT_RETENTION_CLASSES.OPERATIONAL,
  [AUDIT_TARGET_KINDS.SALES_INSTANCE]:
    AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
  [AUDIT_TARGET_KINDS.ORDER]: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
};

export function retentionClassForTargetKind(
  kind: AuditTargetKind,
): AuditRetentionClass {
  return AUDIT_TARGET_RETENTION_CLASSES[kind];
}
