import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  requireApiUser,
  requireShopAccess,
} from "@/lib/auth/apiAuth";

// In-memory transfer log (legacy inter-branch API — not used by warehouse UI)
let transferLogsStore: Array<Record<string, unknown>> = [];

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get("shop_id");

  if (shopId) {
    const access = await requireShopAccess(auth.ctx, shopId);
    if (!access.ok) return access.response;
  } else if (!auth.ctx.isSuperAdmin) {
    return NextResponse.json(
      { success: false, error: "shop_id is required" },
      { status: 400 }
    );
  }

  try {
    const transfers = shopId
      ? transferLogsStore.filter(
          (t) =>
            t.source_shop_id === shopId || t.destination_shop_id === shopId
        )
      : auth.ctx.isSuperAdmin
        ? transferLogsStore
        : transferLogsStore.filter(
            (t) =>
              t.source_shop_id === auth.ctx.shopId ||
              t.destination_shop_id === auth.ctx.shopId
          );

    return NextResponse.json({ success: true, transfers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { sourceShopId, destinationShopId, items, note, transferredBy } = body;

    if (!sourceShopId || !destinationShopId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid transfer parameters" }, { status: 400 });
    }

    if (sourceShopId === destinationShopId) {
      return NextResponse.json(
        { success: false, error: "Source and Destination branches cannot be the same" },
        { status: 450 }
      );
    }

    const sourceAccess = await requireShopAccess(auth.ctx, sourceShopId);
    if (!sourceAccess.ok) return sourceAccess.response;

    const destAccess = await requireShopAccess(auth.ctx, destinationShopId);
    if (!destAccess.ok) return destAccess.response;

    const supabase = createServiceSupabaseClient();

    const { data: sourceShop } = await supabase
      .from("shops")
      .select("name")
      .eq("id", sourceShopId)
      .single();
    const { data: destShop } = await supabase
      .from("shops")
      .select("name")
      .eq("id", destinationShopId)
      .single();

    const transferRef = `ST-${Date.now().toString().slice(-6)}`;
    const processedItems: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const { productId, quantity } = item;
      const transferQty = Number(quantity);

      if (!productId || transferQty <= 0) continue;

      const { data: sourceProduct, error: pErr } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("shop_id", sourceShopId)
        .single();

      if (pErr || !sourceProduct) {
        console.warn(`Product ${productId} not found in source shop`);
        continue;
      }

      const currentSourceQty = Number(sourceProduct.quantity || sourceProduct.current_stock || 0);
      const newSourceQty = Math.max(0, currentSourceQty - transferQty);

      await supabase
        .from("products")
        .update({ quantity: newSourceQty, current_stock: newSourceQty })
        .eq("id", productId)
        .eq("shop_id", sourceShopId);

      let newDestQty = transferQty;

      const barcodeQuery = sourceProduct.barcode || sourceProduct.code
        ? await supabase
            .from("products")
            .select("*")
            .eq("shop_id", destinationShopId)
            .eq("barcode", sourceProduct.barcode || sourceProduct.code)
            .maybeSingle()
        : null;

      const existingDestProd = barcodeQuery?.data;

      if (existingDestProd) {
        newDestQty = Number(existingDestProd.quantity || existingDestProd.current_stock || 0) + transferQty;
        await supabase
          .from("products")
          .update({ quantity: newDestQty, current_stock: newDestQty })
          .eq("id", existingDestProd.id)
          .eq("shop_id", destinationShopId);
      } else {
        await supabase.from("products").insert({
          shop_id: destinationShopId,
          name: sourceProduct.name,
          barcode: sourceProduct.barcode || sourceProduct.code,
          category: sourceProduct.category,
          purchase_price: sourceProduct.purchase_price || sourceProduct.purchase_price_single,
          sale_price: sourceProduct.sale_price || sourceProduct.sale_price_single,
          quantity: transferQty,
          current_stock: transferQty,
          unit: sourceProduct.unit,
          min_stock_alert: sourceProduct.min_stock_alert || sourceProduct.min_stock_level || 5,
        });
      }

      processedItems.push({
        product_name: sourceProduct.name,
        barcode: sourceProduct.barcode || sourceProduct.code || "-",
        transferred_qty: transferQty,
        source_remaining: newSourceQty,
        dest_new_qty: newDestQty,
      });
    }

    const transferRecord = {
      id: transferRef,
      transfer_ref: transferRef,
      source_shop_id: sourceShopId,
      source_shop_name: sourceShop?.name || "Source Branch",
      destination_shop_id: destinationShopId,
      destination_shop_name: destShop?.name || "Destination Branch",
      items: processedItems,
      total_items_count: processedItems.reduce(
        (acc, i) => acc + Number(i.transferred_qty || 0),
        0
      ),
      note: note || "Enterprise Inter-Branch Stock Transfer",
      transferred_by: transferredBy || auth.ctx.user.email || "Authorized user",
      status: "COMPLETED",
      created_at: new Date().toISOString(),
    };

    transferLogsStore.unshift(transferRecord);

    return NextResponse.json({
      success: true,
      message: `Stock Transfer ${transferRef} completed successfully!`,
      transfer: transferRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
