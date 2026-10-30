import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    const body = await req.json();
    const { importType, items, targetShopId } = body;

    let shopId = targetShopId;
    if (!shopId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("shop_id")
          .eq("id", user.id)
          .maybeSingle();
        shopId = profile?.shop_id;
      }
    }

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: "No active business shop specified for import" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items provided for import" },
        { status: 400 }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    if (importType === "products") {
      for (const item of items) {
        if (!item.name || item.name.trim() === "") {
          errorCount++;
          errors.push("Skipped product with empty name");
          continue;
        }

        const salePrice = Number(item.sale_price || item.price || 0);
        const purchasePrice = Number(item.cost_price || item.purchase_price || 0);
        const stock = Number(item.current_stock || item.stock || 0);

        const { data: product, error: prodErr } = await supabase
          .from("products")
          .insert({
            shop_id: shopId,
            name: item.name.trim(),
            sale_price_single: salePrice,
            purchase_price_single: purchasePrice,
            current_stock: stock,
            barcode: item.barcode ? String(item.barcode).trim() : null,
            unit: item.unit ? String(item.unit).trim() : "Pcs",
          })
          .select("id")
          .single();

        if (prodErr) {
          errorCount++;
          errors.push(`Failed to import product "${item.name}": ${prodErr.message}`);
        } else {
          successCount++;
          // If barcode provided, add to product_barcodes table
          if (item.barcode && product?.id) {
            await supabase.from("product_barcodes").insert({
              shop_id: shopId,
              product_id: product.id,
              barcode: String(item.barcode).trim(),
            });
          }
        }
      }
    } else if (importType === "customers" || importType === "suppliers") {
      const partyType = importType === "customers" ? "customer" : "supplier";
      for (const item of items) {
        if (!item.name || item.name.trim() === "") {
          errorCount++;
          errors.push("Skipped record with empty name");
          continue;
        }

        const openingBalance = Number(item.balance || item.opening_balance || 0);

        const { error: partyErr } = await supabase.from("parties").insert({
          shop_id: shopId,
          name: item.name.trim(),
          phone: item.phone ? String(item.phone).trim() : null,
          address: item.address ? String(item.address).trim() : null,
          type: partyType,
          current_balance: openingBalance,
        });

        if (partyErr) {
          errorCount++;
          errors.push(`Failed to import ${partyType} "${item.name}": ${partyErr.message}`);
        } else {
          successCount++;
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid import type specified" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      importedCount: successCount,
      errorCount,
      errors: errors.slice(0, 10), // return top 10 error messages
      timestamp,
    });
  } catch (err: any) {
    console.error("Migration import POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process data import" },
      { status: 500 }
    );
  }
}
