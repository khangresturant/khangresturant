import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, resolveApiShopId } from "@/lib/auth/apiAuth";

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();

  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const requestedShopId = searchParams.get("shopId");

  const resolved = await resolveApiShopId(auth.ctx, requestedShopId);
  if ("error" in resolved) return resolved.error;
  const shopId = resolved.shopId;
  const supabase = auth.ctx.supabase;

  try {
    // 1. Cash & Bank Balances
    const { data: cashData, error: cashErr } = await supabase
      .from("cash_accounts")
      .select("current_balance")
      .eq("shop_id", shopId);
    if (cashErr) throw cashErr;
    const cashTotal = (cashData || []).reduce((sum: number, item: any) => sum + Number(item.current_balance || 0), 0);

    // 2. Accounts Receivable (Customer positive balances)
    const { data: customerData, error: custErr } = await supabase
      .from("parties")
      .select("current_balance")
      .eq("shop_id", shopId)
      .eq("type", "customer");
    if (custErr) throw custErr;
    const receivables = (customerData || []).reduce((sum: number, item: any) => sum + Number(item.current_balance || 0), 0);

    // 3. Accounts Payable (Supplier positive balances, since we store supplier balances as positive amounts we owe them)
    const { data: supplierData, error: suppErr } = await supabase
      .from("parties")
      .select("current_balance")
      .eq("shop_id", shopId)
      .eq("type", "supplier");
    if (suppErr) throw suppErr;
    const payables = (supplierData || []).reduce((sum: number, item: any) => sum + Number(item.current_balance || 0), 0);

    // 4. Inventory Valuation
    const { data: productsData, error: prodErr } = await supabase
      .from("products")
      .select("current_stock, purchase_price_single")
      .eq("shop_id", shopId)
      .gt("current_stock", 0);
    if (prodErr) throw prodErr;
    const productsValuation = (productsData || []).reduce((sum: number, item: any) => sum + (Number(item.current_stock || 0) * Number(item.purchase_price_single || 0)), 0);

    const { data: variantsData, error: varErr } = await supabase
      .from("product_variants")
      .select("stock_quantity, purchase_price")
      .eq("shop_id", shopId)
      .gt("stock_quantity", 0);
    if (varErr) throw varErr;
    const variantsValuation = (variantsData || []).reduce((sum: number, item: any) => sum + (Number(item.stock_quantity || 0) * Number(item.purchase_price || 0)), 0);

    const inventoryValuation = productsValuation + variantsValuation;

    // 5. Showroom Assets & Liabilities Integration
    let showroomStockValuation = 0;
    let showroomInstallmentsReceivable = 0;
    let showroomPartyReceivables = 0;
    let showroomPartyPayables = 0;
    let showroomInvestorPayables = 0;

    try {
      // 5.1 Available Showroom Vehicles Inventory
      const { data: showroomVehicles } = await supabase
        .from("showroom_vehicles")
        .select("purchase_cost")
        .eq("shop_id", shopId)
        .eq("status", "available");

      if (showroomVehicles && showroomVehicles.length > 0) {
        showroomStockValuation = showroomVehicles.reduce((sum: number, v: any) => sum + Number(v.purchase_cost || 0), 0);
      }

      // 5.2 Active Installment Agreements Portfolio Receivables
      const { data: activeInstallments } = await supabase
        .from("showroom_installments")
        .select("remaining_balance, total_price, total_paid")
        .eq("shop_id", shopId)
        .in("status", ["active", "overdue"]);

      if (activeInstallments && activeInstallments.length > 0) {
        showroomInstallmentsReceivable = activeInstallments.reduce((sum: number, i: any) => {
          const rem = i.remaining_balance !== null && i.remaining_balance !== undefined
            ? Number(i.remaining_balance)
            : Math.max(0, Number(i.total_price || 0) - Number(i.total_paid || 0));
          return sum + rem;
        }, 0);
      }

      // 5.3 Showroom Parties Khata Balances
      const { data: showroomParties } = await supabase
        .from("showroom_parties")
        .select("current_balance")
        .eq("shop_id", shopId);

      if (showroomParties && showroomParties.length > 0) {
        showroomParties.forEach((p: any) => {
          const bal = Number(p.current_balance || 0);
          if (bal > 0) showroomPartyReceivables += bal;
          else if (bal < 0) showroomPartyPayables += Math.abs(bal);
        });
      }

      // 5.4 Showroom Investors Capital / Payable Balances
      const { data: showroomInvestors } = await supabase
        .from("showroom_investors")
        .select("current_balance")
        .eq("shop_id", shopId);

      if (showroomInvestors && showroomInvestors.length > 0) {
        showroomInvestorPayables = showroomInvestors.reduce((sum: number, inv: any) => sum + Number(inv.current_balance || 0), 0);
      }
    } catch (showroomErr) {
      console.warn("Showroom balance sheet integration skipped:", showroomErr);
    }

    // 6. Fixed Assets
    const { data: assetsData, error: assetErr } = await supabase
      .from("fixed_assets")
      .select("current_value")
      .eq("shop_id", shopId);
    let fixedAssetsValuation = 0;
    if (!assetErr && assetsData) {
      fixedAssetsValuation = assetsData.reduce((sum: number, item: any) => sum + Number(item.current_value || 0), 0);
    }

    const totalCombinedInventory = inventoryValuation + showroomStockValuation;
    const totalCombinedReceivables = receivables + showroomInstallmentsReceivable + showroomPartyReceivables;
    const totalCombinedPayables = payables + showroomPartyPayables + showroomInvestorPayables;

    const totalAssets = cashTotal + totalCombinedReceivables + totalCombinedInventory + fixedAssetsValuation;
    const totalLiabilities = totalCombinedPayables;
    const equity = totalAssets - totalLiabilities;

    return NextResponse.json({
      success: true,
      data: {
        cashTotal,
        receivables: totalCombinedReceivables,
        payables: totalCombinedPayables,
        inventoryValuation: totalCombinedInventory,
        fixedAssetsValuation,
        totalAssets,
        totalLiabilities,
        equity,
        retailReceivables: receivables,
        showroomInstallmentsReceivable,
        showroomPartyReceivables,
        retailPayables: payables,
        showroomPartyPayables,
        showroomInvestorPayables,
        retailInventory: inventoryValuation,
        showroomStockValuation
      },
      error: null,
      timestamp
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "REPORT_CALCULATION_FAILED", message: err.message }, timestamp },
      { status: 500 }
    );
  }
}
