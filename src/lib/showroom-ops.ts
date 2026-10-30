import { createClient } from "@/lib/supabase/client";

export type VehiclePurpose = "sale" | "rental" | "installment" | "both";
export type VehicleStatus = "available" | "reserved" | "rented" | "sold" | "installment_active";
export type RentalStatus = "active" | "overdue" | "returned" | "cancelled";
export type InstallmentStatus = "active" | "completed" | "overdue" | "defaulted" | "cancelled";
export type ScheduleStatus = "unpaid" | "paid" | "partial" | "overdue";
export type PartyType = "buyer" | "seller" | "both" | "dealer" | "investor";

export type InvestorShareType = "profit_only" | "profit_and_loss" | "fixed_amount" | "monthly_roi";
export type InvestorTxType =
  | "capital_inflow"
  | "profit_share"
  | "loss_share"
  | "profit_payout"
  | "capital_withdrawal"
  | "vehicle_investment";

export type ShowroomInvestor = {
  id: string;
  shop_id?: string | null;
  name: string;
  father_name?: string | null;
  phone: string;
  whatsapp?: string | null;
  cnic?: string | null;
  city?: string | null;
  address?: string | null;
  default_share_type: InvestorShareType;
  default_share_value: number; // e.g. 50% or flat PKR
  total_invested?: number;
  total_profit_earned?: number;
  total_withdrawn?: number;
  current_balance?: number;
  notes?: string | null;
  status: "active" | "inactive";
  created_at?: string | null;
};

export type ShowroomInvestorTx = {
  id: string;
  shop_id?: string | null;
  investor_id: string;
  vehicle_id?: string | null;
  tx_type: InvestorTxType;
  share_type?: InvestorShareType | null;
  share_percentage?: number | null;
  amount: number;
  account_id?: string | null;
  date: string;
  description?: string | null;
  created_at?: string | null;
  
  // Joined
  investor?: ShowroomInvestor | null;
  vehicle?: ShowroomVehicle | null;
};

export type ShowroomParty = {
  id: string;
  shop_id?: string | null;
  party_type: PartyType;
  is_dealer_showroom: boolean;
  name: string;
  father_name?: string | null;
  caste?: string | null;
  cnic?: string | null;
  phone: string;
  whatsapp?: string | null;
  city?: string | null;
  address?: string | null;
  photo_url?: string | null;
  cnic_front_url?: string | null;
  cnic_back_url?: string | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

export type DocumentStatus = "in_showroom" | "with_seller" | "with_customer" | "in_bank_excise" | "other";

export type ShowroomVehicle = {
  id: string;
  shop_id?: string | null;
  vehicle_type?: "car" | "bike" | "commercial";
  make: string;
  model: string;
  variant?: string | null;
  seller_name?: string | null;
  purchase_price?: number | null;
  year: string | number | null;
  plate_number: string | null;
  is_applied_for?: boolean;
  chassis_number?: string | null;
  engine_number?: string | null;
  color?: string | null;
  engine_cc?: number | null;
  
  // Document Custody & Status
  document_status?: DocumentStatus | null;
  document_location?: string | null;
  document_notes?: string | null;
  document_checklist?: {
    file_complete?: boolean;
    smart_card?: boolean;
    original_book?: boolean;
    return_file?: boolean;
    biometric_letter?: boolean;
    token_cleared?: boolean;
  } | null;
  
  // Purchase details
  purchase_party_id?: string | null;
  purchase_cost?: number | null;
  purchase_paid_amount?: number | null;
  purchase_remaining_amount?: number | null;
  purchase_date?: string | null;
  purchase_payment_mode?: "cash" | "bank" | "credit" | "partial";
  
  // Prices
  price: number;
  cash_price?: number | null;
  installment_price?: number | null;
  daily_rental_rate?: number | null;
  
  // Purpose & Status
  purpose?: VehiclePurpose | null;
  status: VehicleStatus;
  
  // Media & Docs
  photos?: string[];
  documents?: { name: string; url: string }[];
  drive_folder_id?: string | null;
  
  // Sold details
  buyer_party_id?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  sold_at?: string | null;
  sold_price?: number | null;
  sale_paid_amount?: number | null;
  sale_remaining_amount?: number | null;
  bill_no?: string | null;
  manual_book_no?: string | null;
  manual_receipt_no?: string | null;
  witness_name?: string | null;
  witness_phone?: string | null;
  witness_cnic?: string | null;
  
  // Regulatory
  tracker_installed?: boolean;
  tracker_company?: string | null;
  excise_token_expiry?: string | null;
  insurance_expiry?: string | null;
  fitness_expiry?: string | null;
  route_permit_expiry?: string | null;
  notes?: string | null;
  created_at?: string | null;

  // Investor Partnership & Co-funding
  investor_id?: string | null;
  investor_share_type?: InvestorShareType | null;
  investor_share_value?: number | null;
  investor_investment_amount?: number | null;
  investor_profit_settled?: boolean;
  investor_profit_amount?: number | null;

  // Joined relations
  purchase_party?: ShowroomParty | null;
  buyer_party?: ShowroomParty | null;
  investor?: ShowroomInvestor | null;
};

export type ShowroomSale = {
  id: string;
  shop_id?: string | null;
  vehicle_id?: string | null;
  buyer_party_id?: string | null;
  buyer_name: string;
  buyer_father_name?: string | null;
  buyer_caste?: string | null;
  buyer_phone?: string | null;
  buyer_cnic?: string | null;
  buyer_address?: string | null;
  sale_type: "cash" | "installment";
  sale_price: number;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  payment_mode?: string | null;
  account_id?: string | null;
  bill_no?: string | null;
  manual_book_no?: string | null;
  manual_receipt_no?: string | null;
  witness_name?: string | null;
  witness_phone?: string | null;
  witness_cnic?: string | null;
  sale_date?: string | null;
  notes?: string | null;
  created_at?: string | null;

  // Joined relations
  vehicle?: ShowroomVehicle | null;
  buyer_party?: ShowroomParty | null;
};

export type ShowroomRental = {
  id: string;
  shop_id?: string | null;
  vehicle_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_cnic?: string | null;
  start_date: string;
  end_date: string;
  returned_at?: string | null;
  daily_rate: number;
  security_deposit: number;
  advance_amount?: number | null;
  deposit_returned?: number | null;
  late_fee_per_day?: number | null;
  late_fee_charged?: number | null;
  notes?: string | null;
  status: RentalStatus;
  created_at?: string | null;
  showroom_vehicles?: {
    make: string;
    model: string;
    plate_number: string | null;
  } | null;
};

export type InstallmentPromise = {
  id: string;
  title: string; // e.g. "وعدہ 1 (عید پر / فصل پر)"
  amount: number;
  due_date: string;
  notes?: string | null;
};

export type ShowroomInstallment = {
  id: string;
  shop_id?: string | null;
  vehicle_id: string | null;
  party_id?: string | null;
  agreement_number: string;
  manual_book_no?: string | null; // دستی کاپی / رجسٹر نمبر
  manual_file_no?: string | null; // فائل نمبر / کسٹمر پرچی ریفرنس
  promises?: InstallmentPromise[] | null;
  
  // Customer details
  customer_name: string;
  customer_father_name?: string | null;
  customer_caste?: string | null;
  customer_cnic?: string | null;
  customer_phone: string;
  customer_phone_2?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_photo_url?: string | null;
  
  // Guarantor 1
  guarantor_1_name?: string | null;
  guarantor_1_father_name?: string | null;
  guarantor_1_caste?: string | null;
  guarantor_1_cnic?: string | null;
  guarantor_1_phone?: string | null;
  guarantor_1_relation?: string | null;
  guarantor_1_address?: string | null;
  guarantor_1_photo_url?: string | null;

  // Guarantor 2
  guarantor_2_name?: string | null;
  guarantor_2_father_name?: string | null;
  guarantor_2_caste?: string | null;
  guarantor_2_cnic?: string | null;
  guarantor_2_phone?: string | null;
  guarantor_2_relation?: string | null;
  guarantor_2_address?: string | null;
  guarantor_2_photo_url?: string | null;

  // Pricing
  cash_price?: number;
  markup_profit?: number;
  total_price: number;
  down_payment: number;
  remaining_balance: number;
  total_installments: number;
  monthly_installment: number;
  frequency: "monthly" | "bi-monthly" | "weekly";

  // Schedule & status
  start_date: string;
  first_due_date: string;
  total_paid: number;
  status: InstallmentStatus;

  // Witnesses & Legal
  witness_1_name?: string | null;
  witness_1_cnic?: string | null;
  witness_1_phone?: string | null;
  witness_2_name?: string | null;
  witness_2_cnic?: string | null;
  witness_2_phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
  
  showroom_vehicles?: ShowroomVehicle | null;
  party?: ShowroomParty | null;
};

export type ShowroomInstallmentSchedule = {
  id: string;
  shop_id?: string | null;
  installment_id: string;
  installment_no: number;
  due_date: string;
  due_amount: number;
  amount?: number | null;
  paid_amount: number;
  paid_date?: string | null;
  late_fee: number;
  discount: number;
  payment_method: string;
  received_by?: string | null;
  receipt_no?: string | null;
  manual_receipt_no?: string | null; // دستی کاٹی گئی رسید نمبر
  manual_book_no?: string | null; // رسید بک نمبر
  is_promise?: boolean | null; // آیا یہ وعدہ / یکمشت ادائیگی ہے
  promise_title?: string | null; // e.g. "وعدہ 1"
  status: ScheduleStatus;
  notes?: string | null;
  created_at?: string | null;
};

export function vehicleLabel(v: Partial<ShowroomVehicle> | null | undefined): string {
  if (!v) return "Unknown Vehicle";
  const plate = v.is_applied_for ? "Applied For" : v.plate_number ? `[${v.plate_number}]` : "";
  return `${v.make || ""} ${v.model || ""} ${v.year || ""} ${plate}`.trim();
}

export function formatPKR(val: number | string | null | undefined): string {
  const n = Number(val) || 0;
  return "Rs " + n.toLocaleString("en-PK");
}

export function rentalDayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 1;
  const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return days <= 0 ? 1 : days;
}

export function deriveRentalStatus(r: {
  status?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  returned_at?: string | null;
  returnedAt?: string | null;
}): RentalStatus {
  if (r.status === "cancelled") return "cancelled";
  if (r.returned_at || r.returnedAt || r.status === "returned") return "returned";
  const ed = r.end_date || r.endDate;
  if (!ed) return "active";
  const today = new Date().toISOString().split("T")[0];
  return ed < today ? "overdue" : "active";
}

export function computeLateFee(r: {
  status?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  returned_at?: string | null;
  returnedAt?: string | null;
  late_fee_per_day?: number | null;
  lateFeePerDay?: number | null;
}): number {
  const ed = r.end_date || r.endDate;
  const perDay = Number(r.late_fee_per_day ?? r.lateFeePerDay ?? 0);
  if (!ed || perDay <= 0) return 0;
  const end = new Date(ed);
  const now = (r.returned_at || r.returnedAt) ? new Date((r.returned_at || r.returnedAt)!) : new Date();
  const diffDays = Math.floor((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays * perDay : 0;
}

export function calculateInvestorProfitShare(
  purchaseCost: number,
  soldPrice: number,
  shareType: InvestorShareType,
  shareValue: number
): { netProfit: number; investorProfit: number; showroomProfit: number; isLoss: boolean } {
  const netProfit = (soldPrice || 0) - (purchaseCost || 0);
  const isLoss = netProfit < 0;
  
  let investorProfit = 0;
  if (shareType === "profit_only") {
    // Only takes profit when positive. In loss, investor receives 0
    if (netProfit > 0) {
      investorProfit = (netProfit * (shareValue || 0)) / 100;
    } else {
      investorProfit = 0;
    }
  } else if (shareType === "profit_and_loss") {
    // Takes percentage of both profit and loss
    investorProfit = (netProfit * (shareValue || 0)) / 100;
  } else if (shareType === "fixed_amount") {
    // Fixed amount per vehicle
    investorProfit = shareValue || 0;
  } else if (shareType === "monthly_roi") {
    // Monthly ROI percentage of invested capital
    investorProfit = ((purchaseCost || 0) * (shareValue || 0)) / 100;
  }
  
  const showroomProfit = netProfit - investorProfit;
  return { netProfit, investorProfit, showroomProfit, isLoss };
}

export function formatInvestorShareBadge(shareType?: InvestorShareType | null, shareValue?: number | null): string {
  if (!shareType) return "شراکت داری";
  const val = Number(shareValue || 0);
  switch (shareType) {
    case "profit_only":
      return `${val}% منافع میں شراکت (Profit Only)`;
    case "profit_and_loss":
      return `${val}% نفع و نقصان شراکت (P&L)`;
    case "fixed_amount":
      return `مقررہ منافع ${formatPKR(val)} (Fixed Profit)`;
    case "monthly_roi":
      return `${val}% ماہانہ منافع (Monthly ROI)`;
    default:
      return `${val}% شراکت`;
  }
}

export const DOCUMENT_STATUS_CONFIG: Record<
  DocumentStatus,
  { labelUrdu: string; labelEn: string; colorClass: string; bgClass: string; borderClass: string; icon: string }
> = {
  in_showroom: {
    labelUrdu: "ہمارے پاس (شو روم محفوظ)",
    labelEn: "With Us / In Showroom Safe",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    icon: "🏢",
  },
  with_seller: {
    labelUrdu: "سیلر / پچھلے مالک کے پاس",
    labelEn: "With Seller / Original Owner",
    colorClass: "text-amber-700",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    icon: "👤",
  },
  with_customer: {
    labelUrdu: "خریدار / کسٹمر کو ہینڈ اوور",
    labelEn: "Handed Over to Buyer / Customer",
    colorClass: "text-blue-700",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    icon: "🤝",
  },
  in_bank_excise: {
    labelUrdu: "بینک / ایکسائز ٹرانسفر پروسیس",
    labelEn: "In Bank / Excise / Transfer",
    colorClass: "text-purple-700",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    icon: "🏛️",
  },
  other: {
    labelUrdu: "دیگر مقام (تفصیل درج ہے)",
    labelEn: "Other / Custom Location",
    colorClass: "text-slate-700",
    bgClass: "bg-slate-100",
    borderClass: "border-slate-200",
    icon: "📌",
  },
};

export function formatDocumentStatusBadge(status?: string | null): {
  labelUrdu: string;
  labelEn: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: string;
} {
  const key = (status || "in_showroom") as DocumentStatus;
  return DOCUMENT_STATUS_CONFIG[key] || DOCUMENT_STATUS_CONFIG.in_showroom;
}

export const SHOWROOM_MIGRATION_SQL = `-- Run once in Supabase SQL editor:
-- 1. SHOWROOM PARTIES (BUYERS, SELLERS, DEALERS & GUARANTORS)
CREATE TABLE IF NOT EXISTS showroom_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    party_type VARCHAR(20) DEFAULT 'buyer',
    is_dealer_showroom BOOLEAN DEFAULT false,
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    caste VARCHAR(100),
    cnic VARCHAR(30),
    phone VARCHAR(40) NOT NULL,
    whatsapp VARCHAR(40),
    city VARCHAR(100) DEFAULT 'Lahore',
    address TEXT,
    photo_url TEXT,
    cnic_front_url TEXT,
    cnic_back_url TEXT,
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SHOWROOM INVESTORS (CAPITAL & PROFIT/LOSS PARTNERS)
CREATE TABLE IF NOT EXISTS showroom_investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    phone VARCHAR(40) NOT NULL,
    whatsapp VARCHAR(40),
    cnic VARCHAR(30),
    city VARCHAR(100) DEFAULT 'Lahore',
    address TEXT,
    default_share_type VARCHAR(30) DEFAULT 'profit_only',
    default_share_value NUMERIC(15, 2) DEFAULT 50,
    total_invested NUMERIC(15, 2) DEFAULT 0,
    total_profit_earned NUMERIC(15, 2) DEFAULT 0,
    total_withdrawn NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SHOWROOM INVESTOR TRANSACTIONS (CAPITAL INFLOW, PROFIT ACCRUAL, PAYOUTS)
CREATE TABLE IF NOT EXISTS showroom_investor_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    investor_id UUID REFERENCES showroom_investors(id) ON DELETE CASCADE,
    vehicle_id UUID,
    tx_type VARCHAR(40) NOT NULL,
    share_type VARCHAR(30),
    share_percentage NUMERIC(8, 2),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SHOWROOM VEHICLES (CARS & MOTORCYCLES INVENTORY)
CREATE TABLE IF NOT EXISTS showroom_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(30) DEFAULT 'car',
    make VARCHAR(100) NOT NULL,
    model VARCHAR(120) NOT NULL,
    year INTEGER,
    plate_number VARCHAR(40),
    is_applied_for BOOLEAN DEFAULT false,
    chassis_number VARCHAR(80),
    engine_number VARCHAR(80),
    color VARCHAR(40),
    engine_cc INTEGER,
    purchase_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    purchase_cost NUMERIC(15, 2) DEFAULT 0,
    purchase_date DATE DEFAULT CURRENT_DATE,
    purchase_payment_mode VARCHAR(30) DEFAULT 'cash',
    price NUMERIC(15, 2) DEFAULT 0,
    cash_price NUMERIC(15, 2) DEFAULT 0,
    installment_price NUMERIC(15, 2) DEFAULT 0,
    daily_rental_rate NUMERIC(15, 2) DEFAULT 0,
    purpose VARCHAR(20) DEFAULT 'sale',
    status VARCHAR(30) DEFAULT 'available',
    photos JSONB DEFAULT '[]'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    drive_folder_id VARCHAR(150),
    buyer_party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    buyer_name VARCHAR(120),
    buyer_phone VARCHAR(40),
    sold_at TIMESTAMPTZ,
    sold_price NUMERIC(15, 2),
    tracker_installed BOOLEAN DEFAULT false,
    tracker_company VARCHAR(100),
    excise_token_expiry DATE,
    insurance_expiry DATE,
    fitness_expiry DATE,
    route_permit_expiry DATE,
    notes TEXT,
    investor_id UUID REFERENCES showroom_investors(id) ON DELETE SET NULL,
    investor_share_type VARCHAR(30) DEFAULT 'profit_only',
    investor_share_value NUMERIC(15, 2) DEFAULT 50,
    investor_investment_amount NUMERIC(15, 2) DEFAULT 0,
    investor_profit_settled BOOLEAN DEFAULT false,
    investor_profit_amount NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SHOWROOM INSTALLMENTS (VEHICLE EMI / QIST AGREEMENTS)
CREATE TABLE IF NOT EXISTS showroom_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES showroom_vehicles(id) ON DELETE SET NULL,
    party_id UUID REFERENCES showroom_parties(id) ON DELETE SET NULL,
    agreement_number VARCHAR(60) NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_father_name VARCHAR(150),
    customer_caste VARCHAR(100),
    customer_cnic VARCHAR(30),
    customer_phone VARCHAR(40) NOT NULL,
    customer_phone_2 VARCHAR(40),
    customer_address TEXT,
    customer_city VARCHAR(80),
    customer_photo_url TEXT,
    guarantor_1_name VARCHAR(150),
    guarantor_1_father_name VARCHAR(150),
    guarantor_1_caste VARCHAR(100),
    guarantor_1_cnic VARCHAR(30),
    guarantor_1_phone VARCHAR(40),
    guarantor_1_relation VARCHAR(80),
    guarantor_1_address TEXT,
    guarantor_1_photo_url TEXT,
    guarantor_2_name VARCHAR(150),
    guarantor_2_father_name VARCHAR(150),
    guarantor_2_caste VARCHAR(100),
    guarantor_2_cnic VARCHAR(30),
    guarantor_2_phone VARCHAR(40),
    guarantor_2_relation VARCHAR(80),
    guarantor_2_address TEXT,
    guarantor_2_photo_url TEXT,
    cash_price NUMERIC(15, 2) DEFAULT 0,
    markup_profit NUMERIC(15, 2) DEFAULT 0,
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    down_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_installments INTEGER NOT NULL DEFAULT 12,
    monthly_installment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    frequency VARCHAR(30) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    first_due_date DATE NOT NULL,
    total_paid NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'active',
    witness_1_name VARCHAR(120),
    witness_1_cnic VARCHAR(30),
    witness_1_phone VARCHAR(40),
    witness_2_name VARCHAR(120),
    witness_2_cnic VARCHAR(30),
    witness_2_phone VARCHAR(40),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SHOWROOM INSTALLMENT SCHEDULES
CREATE TABLE IF NOT EXISTS showroom_installment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES showroom_installments(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    due_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    paid_date TIMESTAMPTZ,
    late_fee NUMERIC(15, 2) DEFAULT 0,
    discount NUMERIC(15, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash',
    received_by VARCHAR(120),
    receipt_no VARCHAR(60),
    status VARCHAR(20) DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SHOWROOM RENTALS
CREATE TABLE IF NOT EXISTS showroom_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES showroom_vehicles(id) ON DELETE SET NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(40),
    customer_cnic VARCHAR(30),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    returned_at TIMESTAMPTZ,
    daily_rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    security_deposit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deposit_returned NUMERIC(15, 2) DEFAULT 0,
    late_fee_per_day NUMERIC(15, 2) DEFAULT 0,
    late_fee_charged NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);
`;

// ─── Showroom Offline Helper Functions ────────────────────────────────────────

export function isShowroomOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export async function saveShowroomOfflineEntity(
  tableName: string,
  data: Record<string, any>,
  shopId: string
): Promise<void> {
  const { putOfflineData } = await import("@/utils/syncQueue");
  await putOfflineData(tableName, {
    ...data,
    shopId,
    _shop_id: shopId,
  });
}

export async function deleteShowroomOfflineEntity(
  tableName: string,
  id: string
): Promise<void> {
  const { deleteOfflineData } = await import("@/utils/syncQueue");
  await deleteOfflineData(tableName, id);
}

export async function loadShowroomOfflineEntities<T = any>(
  tableName: string,
  shopId?: string | null
): Promise<T[]> {
  const { getAllOfflineData } = await import("@/utils/syncQueue");
  const all = await getAllOfflineData(tableName);
  return (all || []).filter(
    (item: any) => !shopId || item.shopId === shopId || item.shop_id === shopId || item._shop_id === shopId
  ) as T[];
}

export async function executeShowroomAction<T = any>(opts: {
  shopId?: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | "insert" | "update" | "delete";
  tableName?: string;
  table?: string;
  payload: Record<string, any>;
  label?: string;
  onlineMutation?: () => Promise<T>;
  onOptimisticSaved?: () => void;
}): Promise<{ queued: boolean; result?: T }> {
  const targetTable = opts.tableName || opts.table || "";
  const normalizedAction = opts.action.toUpperCase() as "INSERT" | "UPDATE" | "DELETE";
  const { pushToSyncQueue, putOfflineData, deleteOfflineData } = await import("@/utils/syncQueue");
  const safeShopId = opts.shopId || "";

  if (isShowroomOffline()) {
    // 1. Queue for background sync
    await pushToSyncQueue(
      normalizedAction,
      targetTable,
      opts.payload,
      safeShopId,
      opts.label || `Offline showroom ${targetTable} ${normalizedAction.toLowerCase()}`
    );

    // 2. Optimistic local IndexedDB update
    if (normalizedAction === "DELETE" && opts.payload.id) {
      await deleteOfflineData(targetTable, String(opts.payload.id)).catch(() => {});
    } else if (opts.payload.id) {
      await putOfflineData(targetTable, {
        ...opts.payload,
        shopId: safeShopId,
        _shop_id: safeShopId,
      }).catch(() => {});
    }

    opts.onOptimisticSaved?.();
    return { queued: true };
  }

  // If online, perform online mutation (or fallback to auto Supabase execution)
  try {
    let result: any;
    if (typeof opts.onlineMutation === "function") {
      result = await opts.onlineMutation();
    } else {
      const supabase = createClient();
      if (normalizedAction === "INSERT") {
        const { data, error } = await supabase.from(targetTable).insert(opts.payload).select();
        if (error) throw error;
        result = data;
      } else if (normalizedAction === "UPDATE") {
        const { id, ...rest } = opts.payload;
        if (!id) throw new Error(`Missing id for update on table ${targetTable}`);
        const { data, error } = await supabase.from(targetTable).update(rest).eq("id", id).select();
        if (error) throw error;
        result = data;
      } else if (normalizedAction === "DELETE") {
        const id = opts.payload.id;
        if (!id) throw new Error(`Missing id for delete on table ${targetTable}`);
        const { data, error } = await supabase.from(targetTable).delete().eq("id", id);
        if (error) throw error;
        result = data;
      }
    }

    // Also cache locally for future offline reads
    if (normalizedAction === "DELETE" && opts.payload.id) {
      await deleteOfflineData(targetTable, String(opts.payload.id)).catch(() => {});
    } else if (opts.payload.id) {
      await putOfflineData(targetTable, {
        ...opts.payload,
        shopId: opts.shopId,
        _shop_id: opts.shopId,
      }).catch(() => {});
    }
    return { queued: false, result };
  } catch (err: any) {
    const isNetwork =
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("NetworkError") ||
      err?.message?.includes("network") ||
      (typeof navigator !== "undefined" && !navigator.onLine);

    if (isNetwork) {
      await pushToSyncQueue(
        normalizedAction,
        targetTable,
        opts.payload,
        safeShopId,
        opts.label || `Offline showroom ${targetTable} ${normalizedAction.toLowerCase()}`
      );
      if (normalizedAction === "DELETE" && opts.payload.id) {
        await deleteOfflineData(targetTable, String(opts.payload.id)).catch(() => {});
      } else if (opts.payload.id) {
        await putOfflineData(targetTable, {
          ...opts.payload,
          shopId: safeShopId,
          _shop_id: safeShopId,
        }).catch(() => {});
      }
      opts.onOptimisticSaved?.();
      return { queued: true };
    }
    throw err;
  }
}


