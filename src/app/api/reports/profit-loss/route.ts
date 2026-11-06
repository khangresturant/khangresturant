import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, resolveApiShopId } from "@/lib/auth/apiAuth";

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();

  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const endDate = searchParams.get("endDate") || new Date().toISOString();
  const requestedShopId = searchParams.get("shopId");

  const resolved = await resolveApiShopId(auth.ctx, requestedShopId);
  if ("error" in resolved) return resolved.error;
  const shopId = resolved.shopId;
  const supabase = auth.ctx.supabase;

  try {
    // 1. Fetch Invoices in date range
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("id, total_amount, discount_amount, tax_amount")
      .eq("shop_id", shopId)
      .eq("is_voided", false)
      .neq("status", "quotation")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (invErr) throw invErr;

    const invoiceIds = (invoices || []).map((i: any) => i.id);
    const revenue = (invoices || []).reduce((sum: number, item: any) => sum + Number(item.total_amount || 0), 0);

    // 2. Fetch Invoice Items to calculate COGS
    let cogs = 0;
    if (invoiceIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("product_id, variant_id, quantity")
        .in("invoice_id", invoiceIds);

      if (itemsErr) throw itemsErr;

      if (items && items.length > 0) {
        const productIds = Array.from(new Set(items.map((it: any) => it.product_id)));
        const variantIds = Array.from(new Set(items.map((it: any) => it.variant_id).filter(Boolean)));

        // Fetch purchase costs
        const [productsRes, variantsRes] = await Promise.all([
          productIds.length > 0 ? supabase.from("products").select("id, purchase_price_single").in("id", productIds) : { data: [] },
          variantIds.length > 0 ? supabase.from("product_variants").select("id, purchase_price").in("id", variantIds) : { data: [] }
        ]);

        const productCostMap: Record<string, number> = {};
        (productsRes.data || []).forEach((p: any) => {
          productCostMap[p.id] = Number(p.purchase_price_single || 0);
        });

        const variantCostMap: Record<string, number> = {};
        (variantsRes.data || []).forEach((v: any) => {
          variantCostMap[v.id] = Number(v.purchase_price || 0);
        });

        items.forEach((it: any) => {
          const itemCost = it.variant_id && variantCostMap[it.variant_id]
            ? variantCostMap[it.variant_id]
            : (productCostMap[it.product_id] || 0);
          cogs += itemCost * Number(it.quantity || 0);
        });
      }
    }

    // 3. Fetch Expenses
    const { data: expenses, error: expErr } = await supabase
      .from("expenses")
      .select("amount")
      .eq("shop_id", shopId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (expErr) throw expErr;

    const totalExpenses = (expenses || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    // 4. Showroom Integration: Sold vehicles (Cash Sales + Installment Sales)
    let showroomRevenue = 0;
    let showroomCogs = 0;
    let showroomExpenses = 0;

    try {
      const { data: soldVehicles } = await supabase
        .from("showroom_vehicles")
        .select("id, status, purchase_cost, cash_price, price, sold_price, sold_at, created_at")
        .eq("shop_id", shopId)
        .in("status", ["sold", "installment_active"]);

      if (soldVehicles && soldVehicles.length > 0) {
        soldVehicles.forEach((v: any) => {
          const saleDate = v.sold_at || v.created_at;
          if (saleDate && saleDate >= startDate && saleDate <= endDate) {
            const salePrice = Number(v.sold_price || v.cash_price || v.price || 0);
            const costPrice = Number(v.purchase_cost || 0);
            showroomRevenue += salePrice;
            showroomCogs += costPrice;
          }
        });
      }

      // Showroom vehicle repair/refurbishment expenses
      const { data: vehExpenses } = await supabase
        .from("showroom_vehicle_expenses")
        .select("amount, expense_date, created_at")
        .eq("shop_id", shopId);

      if (vehExpenses && vehExpenses.length > 0) {
        vehExpenses.forEach((ve: any) => {
          const eDate = ve.expense_date || ve.created_at;
          if (eDate && eDate >= startDate && eDate <= endDate) {
            showroomExpenses += Number(ve.amount || 0);
          }
        });
      }
    } catch (showroomErr) {
      console.warn("Showroom P&L integration skipped or no showroom tables:", showroomErr);
    }

    const totalCombinedRevenue = revenue + showroomRevenue;
    const totalCombinedCogs = cogs + showroomCogs;
    const totalCombinedExpenses = totalExpenses + showroomExpenses;

    const grossProfit = totalCombinedRevenue - totalCombinedCogs;
    const netProfit = grossProfit - totalCombinedExpenses;

    return NextResponse.json({
      success: true,
      data: {
        revenue: totalCombinedRevenue,
        cogs: totalCombinedCogs,
        grossProfit,
        expenses: totalCombinedExpenses,
        netProfit,
        retailRevenue: revenue,
        retailCogs: cogs,
        showroomRevenue,
        showroomCogs,
        showroomExpenses,
        startDate,
        endDate
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
