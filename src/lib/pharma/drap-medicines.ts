// Auto-generated 100% Official DRAP Master Drug Database (2026)
import drapMedicinesData from "./drap-master-medicines.json";

export interface MasterMedicineItem {
  name: string;
  formula: string;
  pack_size: number;
  purchase_price: number;
  sale_price: number;
  type: string;
  manufacturer: string;
  reg_number?: string;
  category?: string;
  effective_date?: string;
}

export const DRAP_MASTER_MEDICINES: MasterMedicineItem[] = drapMedicinesData as MasterMedicineItem[];
