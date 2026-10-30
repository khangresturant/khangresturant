import { createClient } from "@/lib/supabase/client";
import { vehicleLabel, type ShowroomVehicle, type ShowroomSale, type ShowroomInstallment, type ShowroomInstallmentSchedule } from "./showroom-ops";

export interface ShowroomSubLedgerBalances {
  receivables: number;
  payables: number;
  inventoryValue: number;
  cashInHand: number;
  totalVehiclesInStock: number;
  totalActiveInstallments: number;
  totalReceivables?: number;
  totalPayables?: number;
  vehicleStockValue?: number;
  availableVehicleCount?: number;
  receivablesBreakdown: {
    installmentsRemaining: number;
    partiesReceivable: number;
    total: number;
  };
  payablesBreakdown: {
    vehiclePurchaseRemaining: number;
    dealersPayable: number;
    total: number;
  };
}

/**
 * Auto-syncs "Parties & Dealers" sub-ledger and installment contract balances
 * directly into Balance Sheet heads without manual journal entries:
 * - Receivables: Active Installments balance + Buyer Parties
 * - Payables: Vehicle purchase remaining cost + Seller/Dealer Parties
 * - Vehicle Inventory Asset: Cost of all available vehicles in stock
 */
export async function fetchShowroomSubLedgerBalances(
  supabase: any,
  shopId: string
): Promise<ShowroomSubLedgerBalances> {
  if (!shopId) {
    return {
      receivables: 0,
      payables: 0,
      inventoryValue: 0,
      cashInHand: 0,
      totalVehiclesInStock: 0,
      totalActiveInstallments: 0,
      receivablesBreakdown: { installmentsRemaining: 0, partiesReceivable: 0, total: 0 },
      payablesBreakdown: { vehiclePurchaseRemaining: 0, dealersPayable: 0, total: 0 },
    };
  }

  try {
    const [vehiclesRes, installmentsRes, partiesRes, accountsRes] = await Promise.all([
      supabase
        .from("showroom_vehicles")
        .select("id, make, model, status, purchase_cost, purchase_remaining_amount")
        .eq("shop_id", shopId),
      supabase
        .from("showroom_installments")
        .select("id, remaining_balance, status")
        .eq("shop_id", shopId),
      supabase
        .from("showroom_parties")
        .select("id, party_type, is_dealer_showroom, current_balance")
        .eq("shop_id", shopId),
      supabase
        .from("cash_accounts")
        .select("id, current_balance, type")
        .eq("shop_id", shopId),
    ]);

    const vehicles: any[] = vehiclesRes.data || [];
    const installments: any[] = installmentsRes.data || [];
    const parties: any[] = partiesRes.data || [];
    const accounts: any[] = accountsRes.data || [];

    // 1. Inventory Asset: Sum purchase cost of vehicles currently available in stock
    const availableVehicles = vehicles.filter((v) => v.status === "available");
    const inventoryValue = availableVehicles.reduce(
      (sum, v) => sum + (Number(v.purchase_cost) || 0),
      0
    );

    // 2. Receivables from Installment Agreements
    const activeInstallments = installments.filter((i) => i.status === "active");
    const installmentsRemaining = activeInstallments.reduce(
      (sum, i) => sum + (Number(i.remaining_balance) || 0),
      0
    );

    // 3. Receivables & Payables from Parties & Dealers
    let partiesReceivable = 0;
    let dealersPayable = 0;

    parties.forEach((p) => {
      const bal = Number(p.current_balance) || 0;
      if (bal > 0) {
        // Positive balance on buyer/dealer = money receivable
        partiesReceivable += bal;
      } else if (bal < 0) {
        // Negative balance on seller/dealer = money payable (supplier credit)
        dealersPayable += Math.abs(bal);
      }
    });

    // 4. Vehicle Purchase Remaining Payables (if not yet settled with seller/dealer)
    const vehiclePurchaseRemaining = vehicles.reduce(
      (sum, v) => sum + (Number(v.purchase_remaining_amount) || 0),
      0
    );

    // If dealer payable is already captured in parties ledger, take the maximum or sum without double counting
    const totalPayables = Math.max(vehiclePurchaseRemaining, dealersPayable) > 0 
      ? Math.max(vehiclePurchaseRemaining, dealersPayable)
      : (vehiclePurchaseRemaining + dealersPayable);

    const totalReceivables = installmentsRemaining + partiesReceivable;

    // 5. Total Cash & Bank
    const cashInHand = accounts.reduce(
      (sum, a) => sum + (Number(a.current_balance) || 0),
      0
    );

    return {
      receivables: totalReceivables,
      payables: totalPayables,
      inventoryValue,
      cashInHand,
      totalVehiclesInStock: availableVehicles.length,
      totalActiveInstallments: activeInstallments.length,
      totalReceivables,
      totalPayables,
      vehicleStockValue: inventoryValue,
      availableVehicleCount: availableVehicles.length,
      receivablesBreakdown: {
        installmentsRemaining,
        partiesReceivable,
        total: totalReceivables,
      },
      payablesBreakdown: {
        vehiclePurchaseRemaining,
        dealersPayable,
        total: totalPayables,
      },
    };
  } catch (err) {
    console.error("fetchShowroomSubLedgerBalances error:", err);
    return {
      receivables: 0,
      payables: 0,
      inventoryValue: 0,
      cashInHand: 0,
      totalVehiclesInStock: 0,
      totalActiveInstallments: 0,
      receivablesBreakdown: { installmentsRemaining: 0, partiesReceivable: 0, total: 0 },
      payablesBreakdown: { vehiclePurchaseRemaining: 0, dealersPayable: 0, total: 0 },
    };
  }
}

/**
 * 1. Auto-Posts Balanced Double-Entry Journal for Vehicle Purchase
 * Debit: Stock / Inventory Asset (1003) = purchase_cost
 * Credit: Cash & Bank Accounts (1001) = paid_amount (if paid)
 * Credit: Accounts Payable (2001) = remaining_amount (if udhar)
 */
export async function autoPostVehiclePurchaseJournal(
  supabase: any,
  shopId: string,
  vehicle: Partial<ShowroomVehicle>,
  options?: { accountId?: string; sellerName?: string }
): Promise<string | null> {
  const cost = Number(vehicle.purchase_cost) || 0;
  if (cost <= 0 || !shopId) return null;

  const paid = Number(vehicle.purchase_paid_amount) || 0;
  const remaining = Number(vehicle.purchase_remaining_amount) || Math.max(0, cost - paid);
  const seller = options?.sellerName || vehicle.seller_name || "Showroom Seller / Dealer";
  const vTitle = vehicleLabel(vehicle);
  const entryDate = vehicle.purchase_date || new Date().toISOString().split("T")[0];

  try {
    const { data: jeData, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        shop_id: shopId,
        entry_date: entryDate,
        ref_type: "showroom_vehicle_purchase",
        ref_id: vehicle.id ? String(vehicle.id) : null,
        narration: `🚗 Vehicle Purchase [Inflow]: ${vTitle} from ${seller} — Total Cost: Rs ${cost.toLocaleString()} (Paid: Rs ${paid.toLocaleString()}, Udhar/Payable: Rs ${remaining.toLocaleString()})`,
      })
      .select("id")
      .single();

    if (jeErr || !jeData) {
      console.warn("autoPostVehiclePurchaseJournal insert warning:", jeErr);
      return null;
    }

    const lines: any[] = [
      {
        entry_id: jeData.id,
        account_code: "1003",
        account_name: "Stock / Inventory Asset (Vehicles)",
        debit: cost,
        credit: 0,
      },
    ];

    if (paid > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "1001",
        account_name: "Cash & Bank Accounts",
        debit: 0,
        credit: paid,
      });
    }

    if (remaining > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "2001",
        account_name: "Accounts Payable (Vehicle Sellers/Dealers)",
        debit: 0,
        credit: remaining,
      });
    }

    // Guard if cost != paid + remaining: adjust payable
    const sumCredits = (paid > 0 ? paid : 0) + (remaining > 0 ? remaining : 0);
    if (sumCredits < cost) {
      lines.push({
        entry_id: jeData.id,
        account_code: "2001",
        account_name: "Accounts Payable (Vehicle Sellers/Dealers)",
        debit: 0,
        credit: cost - sumCredits,
      });
    }

    await supabase.from("journal_lines").insert(lines);
    return jeData.id;
  } catch (err) {
    console.error("autoPostVehiclePurchaseJournal error:", err);
    return null;
  }
}

/**
 * 2. Auto-Posts Balanced Double-Entry Journal for Vehicle Cash Sale
 * Debit: Cash & Bank Accounts (1001) = paid_amount
 * Debit: Accounts Receivable (1002) = remaining_amount
 * Credit: Sales Revenue (4001) = sale_price
 * Debit: Cost of Goods / Purchases (5001) = purchase_cost
 * Credit: Stock / Inventory Asset (1003) = purchase_cost
 */
export async function autoPostVehicleSaleJournal(
  supabase: any,
  shopId: string,
  sale: Partial<ShowroomSale> | Record<string, any>,
  vehicle: Partial<ShowroomVehicle> | Record<string, any>,
  options?: { buyerName?: string }
): Promise<string | null> {
  const salePrice = Number(sale.sale_price) || 0;
  if (salePrice <= 0 || !shopId) return null;

  const paid = Number(sale.paid_amount) || 0;
  const remaining = Number(sale.remaining_amount) || Math.max(0, salePrice - paid);
  let purchaseCost = Number(vehicle?.purchase_cost) || 0;
  const targetVehicleId = sale.vehicle_id || vehicle?.id;
  if (purchaseCost <= 0 && targetVehicleId) {
    try {
      const { data: vDb } = await supabase
        .from("showroom_vehicles")
        .select("purchase_cost, make, model, year, plate_number")
        .eq("id", targetVehicleId)
        .maybeSingle();
      if (vDb) {
        purchaseCost = Number(vDb.purchase_cost) || 0;
        if (!vehicle.make && vDb.make) vehicle.make = vDb.make;
        if (!vehicle.model && vDb.model) vehicle.model = vDb.model;
        if (!vehicle.year && vDb.year) vehicle.year = vDb.year;
        if (!vehicle.plate_number && vDb.plate_number) vehicle.plate_number = vDb.plate_number;
      }
    } catch (e) {
      console.warn("Could not query vehicle purchase cost for sale:", e);
    }
  }
  const buyer = options?.buyerName || sale.buyer_name || "Walk-in Buyer";
  const vTitle = vehicleLabel(vehicle);
  const entryDate = sale.sale_date || new Date().toISOString().split("T")[0];

  try {
    const { data: jeData, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        shop_id: shopId,
        entry_date: entryDate,
        ref_type: "showroom_vehicle_sale",
        ref_id: vehicle.id ? String(vehicle.id) : sale.id ? String(sale.id) : null,
        narration: `🚗 Vehicle Cash Sale [Outflow]: ${vTitle} to ${buyer} — Sale Price: Rs ${salePrice.toLocaleString()} (Paid: Rs ${paid.toLocaleString()}, Udhar: Rs ${remaining.toLocaleString()})`,
      })
      .select("id")
      .single();

    if (jeErr || !jeData) {
      console.warn("autoPostVehicleSaleJournal insert warning:", jeErr);
      return null;
    }

    const lines: any[] = [];

    // Revenue & Cash/AR lines
    if (paid > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "1001",
        account_name: "Cash & Bank Accounts",
        debit: paid,
        credit: 0,
      });
    }

    if (remaining > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "1002",
        account_name: "Accounts Receivable (Vehicle Buyers)",
        debit: remaining,
        credit: 0,
      });
    }

    lines.push({
      entry_id: jeData.id,
      account_code: "4001",
      account_name: "Sales Revenue (Showroom Vehicles)",
      debit: 0,
      credit: salePrice,
    });

    // COGS & Inventory realization
    if (purchaseCost > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "5001",
        account_name: "Cost of Goods / Purchases (Vehicles)",
        debit: purchaseCost,
        credit: 0,
      });
      lines.push({
        entry_id: jeData.id,
        account_code: "1003",
        account_name: "Stock / Inventory Asset (Vehicles)",
        debit: 0,
        credit: purchaseCost,
      });
    }

    await supabase.from("journal_lines").insert(lines);
    return jeData.id;
  } catch (err) {
    console.error("autoPostVehicleSaleJournal error:", err);
    return null;
  }
}

/**
 * 3. Auto-Posts Balanced Double-Entry Journal for Vehicle Installment Agreement
 * Debit: Cash & Bank Accounts (1001) = down_payment
 * Debit: Accounts Receivable (1002) = remaining_balance
 * Credit: Sales Revenue (4001) = total_price
 * Debit: Cost of Goods / Purchases (5001) = purchase_cost
 * Credit: Stock / Inventory Asset (1003) = purchase_cost
 */
export async function autoPostInstallmentAgreementJournal(
  supabase: any,
  shopId: string,
  installment: Partial<ShowroomInstallment> | Record<string, any>,
  vehicle: Partial<ShowroomVehicle> | Record<string, any>
): Promise<string | null> {
  const totalPrice = Number(installment.total_price) || 0;
  if (totalPrice <= 0 || !shopId) return null;

  const downPayment = Number(installment.down_payment) || 0;
  const remainingBal = Number(installment.remaining_balance) || Math.max(0, totalPrice - downPayment);
  let purchaseCost = Number(vehicle?.purchase_cost) || 0;
  const targetVehicleId = installment.vehicle_id || vehicle?.id;
  if (purchaseCost <= 0 && targetVehicleId) {
    try {
      const { data: vDb } = await supabase
        .from("showroom_vehicles")
        .select("purchase_cost, make, model, year, plate_number")
        .eq("id", targetVehicleId)
        .maybeSingle();
      if (vDb) {
        purchaseCost = Number(vDb.purchase_cost) || 0;
        if (!vehicle.make && vDb.make) vehicle.make = vDb.make;
        if (!vehicle.model && vDb.model) vehicle.model = vDb.model;
        if (!vehicle.year && vDb.year) vehicle.year = vDb.year;
        if (!vehicle.plate_number && vDb.plate_number) vehicle.plate_number = vDb.plate_number;
      }
    } catch (e) {
      console.warn("Could not query vehicle purchase cost for installment:", e);
    }
  }
  const customer = installment.customer_name || "Installment Customer";
  const vTitle = vehicleLabel(vehicle);
  const entryDate = installment.start_date || new Date().toISOString().split("T")[0];

  try {
    const { data: jeData, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        shop_id: shopId,
        entry_date: entryDate,
        ref_type: "showroom_installment_agreement",
        ref_id: installment.id ? String(installment.id) : null,
        narration: `🚗 Installment Agreement #${installment.agreement_number || "AGR"}: ${vTitle} to ${customer} — Total: Rs ${totalPrice.toLocaleString()} (Advance: Rs ${downPayment.toLocaleString()}, Installments Due: Rs ${remainingBal.toLocaleString()})`,
      })
      .select("id")
      .single();

    if (jeErr || !jeData) {
      console.warn("autoPostInstallmentAgreementJournal insert warning:", jeErr);
      return null;
    }

    const lines: any[] = [];

    // Advance & Contract Receivable
    if (downPayment > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "1001",
        account_name: "Cash & Bank Accounts",
        debit: downPayment,
        credit: 0,
      });
    }

    if (remainingBal > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "1002",
        account_name: "Accounts Receivable (Installments)",
        debit: remainingBal,
        credit: 0,
      });
    }

    lines.push({
      entry_id: jeData.id,
      account_code: "4001",
      account_name: "Sales Revenue (Showroom Installments)",
      debit: 0,
      credit: totalPrice,
    });

    // COGS & Inventory realization
    if (purchaseCost > 0) {
      lines.push({
        entry_id: jeData.id,
        account_code: "5001",
        account_name: "Cost of Goods / Purchases (Vehicles)",
        debit: purchaseCost,
        credit: 0,
      });
      lines.push({
        entry_id: jeData.id,
        account_code: "1003",
        account_name: "Stock / Inventory Asset (Vehicles)",
        debit: 0,
        credit: purchaseCost,
      });
    }

    await supabase.from("journal_lines").insert(lines);
    return jeData.id;
  } catch (err) {
    console.error("autoPostInstallmentAgreementJournal error:", err);
    return null;
  }
}

/**
 * 4. Auto-Posts Balanced Double-Entry Journal for Monthly Installment Recovery / Payment
 * Debit: Cash & Bank Accounts (1001) = amount_paid
 * Credit: Accounts Receivable (1002) = amount_paid
 */
export async function autoPostInstallmentCollectionJournal(
  supabase: any,
  shopId: string,
  schedule: Partial<ShowroomInstallmentSchedule>,
  installment: Partial<ShowroomInstallment>,
  amountPaid: number,
  options?: { accountId?: string; receiptNo?: string }
): Promise<string | null> {
  const amt = Number(amountPaid) || 0;
  if (amt <= 0 || !shopId) return null;

  const customer = installment.customer_name || "Customer";
  const entryDate = schedule.paid_date ? schedule.paid_date.split("T")[0] : new Date().toISOString().split("T")[0];
  const receiptStr = options?.receiptNo || schedule.receipt_no || schedule.manual_receipt_no || "REC";

  try {
    const { data: jeData, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        shop_id: shopId,
        entry_date: entryDate,
        ref_type: "showroom_installment_payment",
        ref_id: schedule.id ? String(schedule.id) : null,
        narration: `💵 Installment Payment Received: Agreement #${installment.agreement_number || "AGR"} (Inst #${schedule.installment_no || 1}) from ${customer} — Receipt #${receiptStr}`,
      })
      .select("id")
      .single();

    if (jeErr || !jeData) return null;

    await supabase.from("journal_lines").insert([
      {
        entry_id: jeData.id,
        account_code: "1001",
        account_name: "Cash & Bank Accounts",
        debit: amt,
        credit: 0,
      },
      {
        entry_id: jeData.id,
        account_code: "1002",
        account_name: "Accounts Receivable (Installments)",
        debit: 0,
        credit: amt,
      },
    ]);

    return jeData.id;
  } catch (err) {
    console.error("autoPostInstallmentCollectionJournal error:", err);
    return null;
  }
}

/**
 * 5. Auto-Posts Showroom Opening Capital / Cash Float Injection
 * Eliminates negative asset balance anomalies:
 * Debit: Cash in Hand (1001) = amount
 * Credit: Owner's Capital Account (3100) = amount
 */
export async function autoPostShowroomCapitalFloat(
  supabase: any,
  shopId: string,
  accountId: string,
  amount: number,
  narration?: string
): Promise<{ success: boolean; error?: string }> {
  const capAmt = Number(amount) || 0;
  if (capAmt <= 0) return { success: false, error: "Amount must be greater than zero" };
  if (!shopId || !accountId) return { success: false, error: "Shop and Account are required" };

  try {
    // 1. Fetch target cash account
    const { data: acct, error: accGetErr } = await supabase
      .from("cash_accounts")
      .select("id, name, current_balance")
      .eq("id", accountId)
      .eq("shop_id", shopId)
      .single();

    if (accGetErr || !acct) throw new Error("Target Cash Account not found");

    const newBal = (Number(acct.current_balance) || 0) + capAmt;

    // 2. Update cash account balance
    const { error: accUpdErr } = await supabase
      .from("cash_accounts")
      .update({ current_balance: newBal })
      .eq("id", accountId);

    if (accUpdErr) throw accUpdErr;

    // 3. Log cash account transaction
    await supabase.from("account_transactions").insert({
      id: crypto.randomUUID(),
      shop_id: shopId,
      account_id: accountId,
      type: "deposit",
      amount: capAmt,
      description: `💰 Showroom Opening Capital / Cash Float: ${narration || "Owner Capital Injection"} into ${acct.name}`,
      date: new Date().toISOString().split("T")[0],
    });

    // 4. Post Double-Entry Journal Voucher (Debit 1001, Credit 3100)
    const { data: jeData, error: jeErr } = await supabase
      .from("journal_entries")
      .insert({
        shop_id: shopId,
        entry_date: new Date().toISOString().split("T")[0],
        ref_type: "showroom_opening_capital",
        ref_id: accountId,
        narration: `💰 Showroom Capital Float / Opening Investment: ${narration || "Initial Showroom Operating Fund"} into ${acct.name}`,
      })
      .select("id")
      .single();

    if (jeErr || !jeData) throw jeErr;

    await supabase.from("journal_lines").insert([
      {
        entry_id: jeData.id,
        account_code: "1001",
        account_name: "Cash & Bank Accounts",
        debit: capAmt,
        credit: 0,
      },
      {
        entry_id: jeData.id,
        account_code: "3100",
        account_name: "Owner's Capital Account",
        debit: 0,
        credit: capAmt,
      },
    ]);

    return { success: true };
  } catch (err: any) {
    console.error("autoPostShowroomCapitalFloat error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 6. Fetches Showroom Product Flow (Stock Cardex)
 * Real-time stock movement ledger:
 * - Purchases = Qty In (1), Seller Name, Chassis/Engine/Plate, Date
 * - Cash Sales & Installments = Qty Out (1), Buyer/Customer Name, Bill No / Agr No, Date
 */
export async function fetchShowroomProductFlow(
  supabase: any,
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  if (!shopId) return [];

  try {
    const [vehiclesRes, salesRes, installmentsRes] = await Promise.all([
      supabase
        .from("showroom_vehicles")
        .select(`
          id, make, model, year, plate_number, chassis_number, engine_number,
          purchase_cost, purchase_date, status, sold_at, sold_price,
          purchase_party:showroom_parties!showroom_vehicles_purchase_party_id_fkey(name)
        `)
        .eq("shop_id", shopId),
      supabase
        .from("showroom_sales")
        .select(`
          id, vehicle_id, sale_price, sale_date, buyer_name, bill_no,
          showroom_vehicles(make, model, year, plate_number, chassis_number)
        `)
        .eq("shop_id", shopId),
      supabase
        .from("showroom_installments")
        .select(`
          id, vehicle_id, total_price, start_date, customer_name, agreement_number,
          showroom_vehicles(make, model, year, plate_number, chassis_number)
        `)
        .eq("shop_id", shopId),
    ]);

    const vehicles: any[] = vehiclesRes.data || [];
    const sales: any[] = salesRes.data || [];
    const installments: any[] = installmentsRes.data || [];

    const flows: any[] = [];

    // Vehicle Purchases (Stock Inflow)
    vehicles.forEach((v) => {
      const vDate = v.purchase_date || "";
      const inRange = (!startDate || vDate >= startDate) && (!endDate || vDate <= endDate);
      if (!inRange) return;

      const vTitle = vehicleLabel(v);
      const seller = v.purchase_party?.name || v.seller_name || "Seller / Dealer";
      const ref = v.chassis_number ? `Chassis: ${v.chassis_number}` : v.plate_number ? `Plate: ${v.plate_number}` : `Veh #${v.id.substring(0, 8).toUpperCase()}`;

      flows.push({
        id: `veh_in_${v.id}`,
        productId: v.id,
        date: vDate,
        productName: `🚗 ${vTitle}`,
        partyName: seller,
        type: "Purchase",
        qtyIn: 1,
        qtyOut: 0,
        value: Number(v.purchase_cost) || 0,
        ref: `Sourcing: ${ref}`,
      });
    });

    // Vehicle Cash Sales (Stock Outflow)
    sales.forEach((s) => {
      const sDate = s.sale_date ? s.sale_date.split("T")[0] : "";
      const inRange = (!startDate || sDate >= startDate) && (!endDate || sDate <= endDate);
      if (!inRange) return;

      const vTitle = s.showroom_vehicles ? vehicleLabel(s.showroom_vehicles) : "Showroom Vehicle";
      const buyer = s.buyer_name || "Customer";
      const ref = s.bill_no ? `Bill #${s.bill_no}` : `Sale #${s.id.substring(0, 8).toUpperCase()}`;

      flows.push({
        id: `sale_out_${s.id}`,
        productId: s.vehicle_id || s.id,
        date: sDate,
        productName: `🚗 ${vTitle}`,
        partyName: buyer,
        type: "Sale",
        qtyIn: 0,
        qtyOut: 1,
        value: Number(s.sale_price) || 0,
        ref,
      });
    });

    // Vehicle Installment Agreements (Stock Outflow)
    installments.forEach((inst) => {
      const iDate = inst.start_date || "";
      const inRange = (!startDate || iDate >= startDate) && (!endDate || iDate <= endDate);
      if (!inRange) return;

      const vTitle = inst.showroom_vehicles ? vehicleLabel(inst.showroom_vehicles) : "Showroom Vehicle";
      const customer = inst.customer_name || "Customer";
      const ref = inst.agreement_number ? `Agr #${inst.agreement_number}` : `Agr #${inst.id.substring(0, 8).toUpperCase()}`;

      flows.push({
        id: `inst_out_${inst.id}`,
        productId: inst.vehicle_id || inst.id,
        date: iDate,
        productName: `🚗 ${vTitle}`,
        partyName: customer,
        type: "Sale",
        qtyIn: 0,
        qtyOut: 1,
        value: Number(inst.total_price) || 0,
        ref: `Installment: ${ref}`,
      });
    });

    // Sort descending by date
    flows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return flows;
  } catch (err) {
    console.error("fetchShowroomProductFlow error:", err);
    return [];
  }
}

/**
 * 7. Syncs and Generates Missing Historical Journals for Showroom
 * If vehicles, sales, or agreements were added in the past without journals,
 * this function auto-generates balanced double-entry vouchers for them.
 */
export async function syncHistoricalShowroomJournals(
  supabase: any,
  shopId: string
): Promise<{ created: number; skipped: number }> {
  if (!shopId) return { created: 0, skipped: 0 };

  let createdCount = 0;
  let skippedCount = 0;

  try {
    // 1. Fetch existing showroom journal entries to avoid duplication
    const { data: existingJournals } = await supabase
      .from("journal_entries")
      .select("id, ref_type, ref_id")
      .eq("shop_id", shopId)
      .in("ref_type", [
        "showroom_vehicle_purchase",
        "showroom_vehicle_sale",
        "showroom_installment_agreement",
        "showroom_installment_payment",
      ]);

    const existingRefMap = new Set<string>();
    (existingJournals || []).forEach((j: any) => {
      if (j.ref_id) existingRefMap.add(`${j.ref_type}:${j.ref_id}`);
    });

    // 2. Sync Vehicle Purchases
    const { data: vehicles } = await supabase
      .from("showroom_vehicles")
      .select("*")
      .eq("shop_id", shopId);

    for (const v of vehicles || []) {
      const key = `showroom_vehicle_purchase:${v.id}`;
      if (existingRefMap.has(key)) {
        skippedCount++;
        continue;
      }
      const res = await autoPostVehiclePurchaseJournal(supabase, shopId, v);
      if (res) createdCount++;
    }

    // 3. Sync Cash Sales
    const { data: sales } = await supabase
      .from("showroom_sales")
      .select("*, showroom_vehicles(*)")
      .eq("shop_id", shopId);

    for (const s of sales || []) {
      const key = `showroom_vehicle_sale:${s.vehicle_id || s.id}`;
      if (existingRefMap.has(key)) {
        skippedCount++;
        continue;
      }
      const res = await autoPostVehicleSaleJournal(supabase, shopId, s, s.showroom_vehicles || {});
      if (res) createdCount++;
    }

    // 4. Sync Installment Agreements
    const { data: installments } = await supabase
      .from("showroom_installments")
      .select("*, showroom_vehicles(*)")
      .eq("shop_id", shopId);

    for (const inst of installments || []) {
      const key = `showroom_installment_agreement:${inst.id}`;
      if (existingRefMap.has(key)) {
        skippedCount++;
        continue;
      }
      const res = await autoPostInstallmentAgreementJournal(supabase, shopId, inst, inst.showroom_vehicles || {});
      if (res) createdCount++;
    }

    return { created: createdCount, skipped: skippedCount };
  } catch (err) {
    console.error("syncHistoricalShowroomJournals error:", err);
    return { created: createdCount, skipped: skippedCount };
  }
}
