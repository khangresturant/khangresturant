/** Shared Chart of Accounts + Trial Balance helpers (Accounts page & GL reports). */

export type CoaAccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

export type CoaTemplate = {
  code: string;
  name: string;
  type: CoaAccountType;
};

/** Canonical COA - keep in sync across `/dashboard/accounts` and `/dashboard/reports/gl`. */
export const CHART_OF_ACCOUNTS: CoaTemplate[] = [
  { code: "1001", name: "Cash in Hand & Bank Accounts", type: "Asset" },
  { code: "1002", name: "Accounts Receivable (Customer Khata)", type: "Asset" },
  { code: "1003", name: "Stock / Inventory Asset", type: "Asset" },
  { code: "1004", name: "Employee Advances / Deductions", type: "Asset" },
  { code: "1005", name: "Advance to Suppliers", type: "Asset" },
  { code: "1200", name: "Prepaid Expenses & Advances", type: "Asset" },
  { code: "1400", name: "Fixed Assets (General)", type: "Asset" },
  { code: "1410", name: "Fixed Assets: Land & Buildings", type: "Asset" },
  { code: "1420", name: "Fixed Assets: Machinery & Equipment", type: "Asset" },
  { code: "1430", name: "Fixed Assets: Office Furniture & Fixtures", type: "Asset" },
  { code: "1440", name: "Fixed Assets: Vehicles & Computers", type: "Asset" },
  { code: "1500", name: "Fixed Assets & Machinery", type: "Asset" },

  { code: "2001", name: "Accounts Payable (Supplier Khata)", type: "Liability" },
  { code: "2002", name: "Advance from Customers", type: "Liability" },
  { code: "2100", name: "Short-Term Loans & Borrowings", type: "Liability" },
  { code: "2201", name: "Accrued Expenses Payable", type: "Liability" },
  { code: "2300", name: "Tax Payable (GST, VAT, WHT)", type: "Liability" },

  { code: "3100", name: "Owner's Capital Account", type: "Equity" },
  { code: "3200", name: "Owner's Drawings Account", type: "Equity" },
  { code: "3300", name: "Retained Earnings & Reserves", type: "Equity" },

  { code: "4001", name: "Sales Revenue", type: "Revenue" },
  { code: "4002", name: "Discount Received", type: "Revenue" },
  { code: "4100", name: "Service Revenue (Stitching/Repairs)", type: "Revenue" },
  { code: "4300", name: "Other Operating Income", type: "Revenue" },

  { code: "5001", name: "Cost of Goods / Purchases", type: "Expense" },
  { code: "5002", name: "Discount Allowed", type: "Expense" },
  { code: "5003", name: "Operating Expenses (General)", type: "Expense" },
  { code: "5004", name: "Salaries & Wages Expense", type: "Expense" },
  { code: "5100", name: "Rent & Lease Expense", type: "Expense" },
  { code: "5200", name: "Utilities Expense (Electricity, Net)", type: "Expense" },
  { code: "5300", name: "Marketing & Advertising Expense", type: "Expense" },
  { code: "5400", name: "Office Supplies & Maintenance", type: "Expense" },
  { code: "5500", name: "Depreciation Expense", type: "Expense" },
];

export type GlBalanceRow = { name: string; debit: number; credit: number };

export function coaTemplateForCode(code: string): CoaTemplate | undefined {
  return CHART_OF_ACCOUNTS.find((t) => t.code === code);
}

export function glNetBalance(type: CoaAccountType, debit: number, credit: number): number {
  if (type === "Asset" || type === "Expense") return debit - credit;
  return credit - debit;
}

export function rawBalanceFromGlMap(
  glBalances: Record<string, GlBalanceRow>,
  code: string
): number {
  const row = glBalances[code];
  if (!row) return 0;
  const template = coaTemplateForCode(code);
  const type = template?.type ?? (code.startsWith("1") ? "Asset" : code.startsWith("5") ? "Expense" : "Liability");
  return glNetBalance(type, Number(row.debit || 0), Number(row.credit || 0));
}

/** Trial row when ledger debit/credit totals exist (matches GL Reports trial tab). */
export function trialRowFromLedgerTotals(
  type: CoaAccountType,
  ledgerDebit: number,
  ledgerCredit: number
): { rawBal: number; debit: number; credit: number } {
  const debit = Number(ledgerDebit || 0);
  const credit = Number(ledgerCredit || 0);
  return {
    rawBal: glNetBalance(type, debit, credit),
    debit,
    credit,
  };
}

/** Trial row from a single net balance (operational fallback, no journal). */
export function trialRowFromNetBalance(
  type: CoaAccountType,
  rawBal: number
): { rawBal: number; debit: number; credit: number } {
  const isNormalDebit = type === "Asset" || type === "Expense";
  let debit = 0;
  let credit = 0;

  if (isNormalDebit) {
    if (rawBal >= 0) debit = rawBal;
    else credit = Math.abs(rawBal);
  } else if (rawBal >= 0) {
    credit = rawBal;
  } else {
    debit = Math.abs(rawBal);
  }

  return { rawBal, debit, credit };
}

export function isProfitLossOpenInGl(
  glBalances: Record<string, GlBalanceRow>
): boolean {
  return CHART_OF_ACCOUNTS.some((t) => {
    if (t.type !== "Revenue" && t.type !== "Expense") return false;
    return Math.abs(rawBalanceFromGlMap(glBalances, t.code)) > 0.01;
  });
}

export function sumTrialDebitCredit(rows: Array<{ debit: number; credit: number }>): {
  sumDebits: number;
  sumCredits: number;
  isBalanced: boolean;
  variance: number;
} {
  const sumDebits = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const sumCredits = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const variance = Math.abs(sumDebits - sumCredits);
  return {
    sumDebits,
    sumCredits,
    isBalanced: variance < 1,
    variance,
  };
}
