import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  requireApiUser,
  requireShopAccess,
} from "@/lib/auth/apiAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const cookieStore = await cookies();
    const body = await req.json();
    const { products, shop_id: bodyShopId, mode = "merge" } = body;

    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : auth.ctx.supabase;

    let shopId = bodyShopId || cookieStore.get("active_shop_id")?.value || auth.ctx.shopId;

    if (!shopId) {
      const { data: profile } = await adminSupabase
        .from("user_profiles")
        .select("active_shop_id, shop_id")
        .eq("id", auth.ctx.user.id)
        .maybeSingle();

      shopId = profile?.active_shop_id || profile?.shop_id;
    }

    if (!shopId) {
      const { data: firstShop } = await adminSupabase
        .from("shops")
        .select("id")
        .or(`user_id.eq.${auth.ctx.user.id},owner_id.eq.${auth.ctx.user.id}`)
        .maybeSingle();

      shopId = firstShop?.id;
    }

    if (!shopId) {
      return NextResponse.json({ error: "No active shop found for your account" }, { status: 400 });
    }

    const shopCheck = await requireShopAccess(auth.ctx, shopId);
    if (!shopCheck.ok) return shopCheck.response;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "No products provided for setup" }, { status: 400 });
    }

    // Optional: If mode === 'replace', clear existing products first
    if (mode === "replace") {
      await adminSupabase.from("products").delete().eq("shop_id", shopId);
    }

    // 1. Resolve Categories
    const categoryMap: Record<string, string> = {};
    const uniqueCatNames = Array.from(new Set(products.map((p: any) => p.category?.trim()).filter(Boolean)));
    
    if (uniqueCatNames.length > 0) {
      try {
        const { data: existingCats } = await adminSupabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId);

        (existingCats || []).forEach((c: any) => {
          categoryMap[c.name.toLowerCase()] = c.id;
        });

        const newCatNames = uniqueCatNames.filter(name => !categoryMap[name.toLowerCase()]);
        if (newCatNames.length > 0) {
          const toInsert = newCatNames.map(name => ({ shop_id: shopId, name }));
          const { data: insertedCats } = await adminSupabase
            .from("categories")
            .insert(toInsert)
            .select("id, name");

          if (insertedCats) {
            insertedCats.forEach((c: any) => {
              categoryMap[c.name.toLowerCase()] = c.id;
            });
          }
        }
      } catch (e) {
        console.warn("Category resolution warning:", e);
      }
    }

    // 2. Resolve Brands
    const brandMap: Record<string, string> = {};
    const uniqueBrandNames = Array.from(new Set(products.map((p: any) => p.brand?.trim()).filter(Boolean)));
    
    if (uniqueBrandNames.length > 0) {
      try {
        const { data: existingBrands, error: brandFetchErr } = await adminSupabase
          .from("brands")
          .select("id, name")
          .eq("shop_id", shopId);

        if (!brandFetchErr && existingBrands) {
          existingBrands.forEach((b: any) => {
            brandMap[b.name.toLowerCase()] = b.id;
          });

          const newBrandNames = uniqueBrandNames.filter(name => !brandMap[name.toLowerCase()]);
          if (newBrandNames.length > 0) {
            const toInsert = newBrandNames.map(name => ({ shop_id: shopId, name }));
            const { data: insertedBrands } = await adminSupabase
              .from("brands")
              .insert(toInsert)
              .select("id, name");

            if (insertedBrands) {
              insertedBrands.forEach((b: any) => {
                brandMap[b.name.toLowerCase()] = b.id;
              });
            }
          }
        }
      } catch (e) {
        console.warn("Brand resolution warning:", e);
      }
    }

    // 3. Prepare Products & Perform Smart Duplicate Protection
    const hasBrandMap = Object.keys(brandMap).length > 0;
    const productsToInsert = products.map((p: any) => {
      const catId = p.category ? (categoryMap[p.category.trim().toLowerCase()] || null) : null;
      const bId = (hasBrandMap && p.brand) ? (brandMap[p.brand.trim().toLowerCase()] || null) : null;
      
      const item: any = {
        shop_id: shopId,
        name: p.name,
        category_id: catId,
        purchase_price_single: Number(p.purchase_price) || 0,
        sale_price_single: Number(p.sale_price) || 0,
        current_stock: Number(p.current_stock) || 0,
        min_stock_level: 5,
        unit: p.unit || "Pcs",
        code: p.barcode || null
      };

      if (bId) {
        item.brand_id = bId;
      }

      return item;
    });

    // 🔍 Smart Duplicate Check: Fetch existing products in this shop
    let filteredToInsert = productsToInsert;

    if (mode !== "replace") {
      const { data: existingProds } = await adminSupabase
        .from("products")
        .select("name, code")
        .eq("shop_id", shopId);

      const existingNames = new Set((existingProds || []).map((p: any) => p.name.trim().toLowerCase()));
      const existingCodes = new Set((existingProds || []).map((p: any) => p.code ? p.code.trim() : "").filter(Boolean));

      filteredToInsert = productsToInsert.filter((p: any) => {
        const nameKey = p.name.trim().toLowerCase();
        if (existingNames.has(nameKey)) return false;
        if (p.code && existingCodes.has(p.code.trim())) return false;
        return true;
      });
    }

    if (filteredToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        skippedCount: productsToInsert.length,
        message: `All ${productsToInsert.length} products already exist in your catalog! No duplicates added.`
      });
    }

    let insertedProds: any[] | null = null;
    let prodErr: any = null;

    const { data: res1, error: err1 } = await adminSupabase
      .from("products")
      .insert(filteredToInsert)
      .select("id, name, code");

    if (err1) {
      if (err1.message?.includes("brand_id") || err1.hint?.includes("brand_id")) {
        const cleanProds = filteredToInsert.map(({ brand_id, ...rest }: any) => rest);
        const { data: res2, error: err2 } = await adminSupabase
          .from("products")
          .insert(cleanProds)
          .select("id, name, code");

        if (err2) {
          prodErr = err2;
        } else {
          insertedProds = res2;
        }
      } else {
        prodErr = err1;
      }
    } else {
      insertedProds = res1;
    }

    if (prodErr) {
      console.error("Batch setup error:", prodErr);
      return NextResponse.json({ error: prodErr.message || "Failed to insert products" }, { status: 500 });
    }

    // 4. Insert Barcodes safely
    if (insertedProds && insertedProds.length > 0) {
      try {
        const barcodeInserts: any[] = [];
        insertedProds.forEach((ip, idx) => {
          const origCode = filteredToInsert[idx]?.code;
          if (origCode) {
            barcodeInserts.push({
              shop_id: shopId,
              product_id: ip.id,
              barcode: origCode
            });
          }
        });

        if (barcodeInserts.length > 0) {
          await adminSupabase.from("product_barcodes").insert(barcodeInserts);
        }
      } catch (bErr) {
        console.warn("Product barcode insert warning:", bErr);
      }
    }

    const skippedCount = productsToInsert.length - (insertedProds?.length || 0);

    return NextResponse.json({
      success: true,
      count: insertedProds?.length || 0,
      skippedCount: Math.max(0, skippedCount),
      message: `Successfully setup ${insertedProds?.length || 0} new products into store catalog! ${skippedCount > 0 ? `(${skippedCount} duplicates skipped)` : ""}`
    });
  } catch (err: any) {
    console.error("Batch setup catch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
