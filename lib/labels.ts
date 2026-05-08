import type { BucketName } from "./types";

/** Display labels for the 16 GL buckets. Used by the bucket-detail table and
 *  the driver-waterfall tooltip drill-down — keep them in sync here. */
export const BUCKET_LABEL: Record<BucketName, string> = {
  Rent: "Rent",
  Utilities: "Utilities",
  Maintenance: "Maintenance",
  Insurance: "Insurance",
  FacilitiesPayroll: "Facilities payroll",
  Snacks: "Snacks",
  TandE: "T&E",
  OfficeSupplies: "Office supplies",
  TeamEvents: "Team events",
  Postage: "Postage",
  FurnitureOpex: "Furniture (OpEx)",
  EquipSoftware: "Equip & software",
  BankCharges: "Bank charges",
  ProfServices: "Prof. services",
  Taxes: "Taxes",
  Depreciation: "Depreciation",
};
