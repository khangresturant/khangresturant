import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WAZIM_SHOP_ID = "26f63a0a-f317-42be-b8b8-77e7bfaad83c";

async function main() {
  console.log("Seeding Full Master Drug Registry & Invoice Medicines for Wazim Pharmacy...");

  // 1. Create Brands
  const brandNames = [
    "BARAX PHARMA", "MIAN PHARMA", "GSK (GlaxoSmithKline)", "Abbott Laboratories", 
    "Getz Pharma", "Sami Pharmaceuticals", "Searle Company", "Martin Dow", "Pfizer", 
    "Hilton Pharma", "Ferozsons Laboratories", "Bosch Pharmaceuticals", "CCL Pharmaceuticals", 
    "Local General Pharma"
  ];

  const brandMap = new Map();

  for (const bName of brandNames) {
    const { data: existing } = await supabase
      .from("brands")
      .select("id, name")
      .eq("shop_id", WAZIM_SHOP_ID)
      .eq("name", bName)
      .maybeSingle();

    if (existing) {
      brandMap.set(bName, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("brands")
        .insert({ shop_id: WAZIM_SHOP_ID, name: bName })
        .select()
        .single();
      if (created) brandMap.set(bName, created.id);
    }
  }

  // 2. Custom 13 Invoice Items from AR Plus & Mian Pharma Invoices
  const customInvoiceItems = [
    {
      name: "INPAX CAPS 200000IU 1S",
      brand: "BARAX PHARMA",
      code: "020",
      purchase_price_pack: 327.25,
      sale_price_pack: 385.00,
      purchase_price_single: 327.25,
      sale_price_single: 385.00,
      base_price: 385.00,
      pack_size: 1,
      current_stock: 5,
      unit: "Caps",
      note: "Margin: 15%",
      batch_number: "IPX-251",
      expiry_date: "2027-11-01"
    },
    {
      name: "PROCIVA CAP 30S",
      brand: "BARAX PHARMA",
      code: "006",
      purchase_price_pack: 2167.50,
      sale_price_pack: 2550.00,
      purchase_price_single: 72.25,
      sale_price_single: 85.00,
      base_price: 2550.00,
      pack_size: 30,
      current_stock: 1,
      unit: "Caps",
      note: "Margin: 15%",
      batch_number: "PB004",
      expiry_date: "2028-03-01"
    },
    {
      name: "XTRICA 20MG TAB 20S",
      brand: "BARAX PHARMA",
      code: "008",
      purchase_price_pack: 357.00,
      sale_price_pack: 420.00,
      purchase_price_single: 17.85,
      sale_price_single: 21.00,
      base_price: 420.00,
      pack_size: 20,
      current_stock: 3,
      unit: "Tabs",
      note: "Margin: 15%",
      batch_number: "039",
      expiry_date: "2027-06-01"
    },
    {
      name: "FLEXERIL CAP 400MG",
      brand: "MIAN PHARMA",
      code: "90",
      purchase_price_pack: 416.50,
      sale_price_pack: 694.00,
      purchase_price_single: 83.30,
      sale_price_single: 138.80,
      base_price: 694.00,
      pack_size: 5,
      current_stock: 4,
      unit: "Caps",
      note: "Packing: 1*5S~248 | Margin: 40%",
      batch_number: "25F163",
      expiry_date: "2028-05-01"
    },
    {
      name: "DEXLAP 30MG CAP",
      brand: "MIAN PHARMA",
      code: "182",
      purchase_price_pack: 595.00,
      sale_price_pack: 991.60,
      purchase_price_single: 19.83,
      sale_price_single: 33.05,
      base_price: 991.60,
      pack_size: 30,
      current_stock: 1,
      unit: "Caps",
      note: "Packing: 3*10S~306 | Margin: 40%",
      batch_number: "26F021",
      expiry_date: "2028-05-01"
    },
    {
      name: "DEXLAP 60MG CAP",
      brand: "MIAN PHARMA",
      code: "183",
      purchase_price_pack: 850.00,
      sale_price_pack: 1416.60,
      purchase_price_single: 60.71,
      sale_price_single: 101.18,
      base_price: 1416.60,
      pack_size: 14,
      current_stock: 1,
      unit: "Caps",
      note: "Packing: 14S~468 | Margin: 40%",
      batch_number: "26G010",
      expiry_date: "2028-06-01"
    },
    {
      name: "RELIUSLIDE TAB",
      brand: "MIAN PHARMA",
      code: "222",
      purchase_price_pack: 153.00,
      sale_price_pack: 255.00,
      purchase_price_single: 7.65,
      sale_price_single: 12.75,
      base_price: 255.00,
      pack_size: 20,
      current_stock: 2,
      unit: "Tabs",
      note: "Packing: 2*10S~56 | Margin: 40%",
      batch_number: "26A053",
      expiry_date: "2027-12-01"
    },
    {
      name: "VISIONS CALCIFEROL S",
      brand: "MIAN PHARMA",
      code: "238",
      purchase_price_pack: 212.50,
      sale_price_pack: 354.00,
      purchase_price_single: 212.50,
      sale_price_single: 354.00,
      base_price: 354.00,
      pack_size: 1,
      current_stock: 11,
      unit: "Caps",
      note: "Packing: 1S~102 (10 Paid + 1 Bonus) | Margin: 40%",
      batch_number: "26343",
      expiry_date: "2027-12-01"
    },
    {
      name: "NAFCIN 250MG TAB",
      brand: "MIAN PHARMA",
      code: "627",
      purchase_price_pack: 170.00,
      sale_price_pack: 283.30,
      purchase_price_single: 17.00,
      sale_price_single: 28.33,
      base_price: 283.30,
      pack_size: 10,
      current_stock: 3,
      unit: "Tabs",
      note: "Packing: 10S | Margin: 40%",
      batch_number: "26A052",
      expiry_date: "2028-12-01"
    },
    {
      name: "ESOPEP 40MG CAP",
      brand: "MIAN PHARMA",
      code: "1469",
      purchase_price_pack: 323.00,
      sale_price_pack: 538.30,
      purchase_price_single: 23.07,
      sale_price_single: 38.45,
      base_price: 538.30,
      pack_size: 14,
      current_stock: 4,
      unit: "Caps",
      note: "Packing: 14S~117 | Margin: 40%",
      batch_number: "25L031",
      expiry_date: "2027-10-01"
    },
    {
      name: "TUMAPLAX-P TAB",
      brand: "MIAN PHARMA",
      code: "1470",
      purchase_price_pack: 141.95,
      sale_price_pack: 236.50,
      purchase_price_single: 14.20,
      sale_price_single: 23.65,
      base_price: 236.50,
      pack_size: 10,
      current_stock: 3,
      unit: "Tabs",
      note: "Packing: 10S~90 | Margin: 40%",
      batch_number: "26A017",
      expiry_date: "2027-12-01"
    },
    {
      name: "COXYZIN 10MG TAB",
      brand: "MIAN PHARMA",
      code: "1472",
      purchase_price_pack: 53.55,
      sale_price_pack: 89.25,
      purchase_price_single: 5.36,
      sale_price_single: 8.93,
      base_price: 89.25,
      pack_size: 10,
      current_stock: 4,
      unit: "Tabs",
      note: "Packing: 10S~39 | Margin: 40%",
      batch_number: "26E007",
      expiry_date: "2029-04-01"
    },
    {
      name: "MANACID SYP",
      brand: "MIAN PHARMA",
      code: "584",
      purchase_price_pack: 119.00,
      sale_price_pack: 198.30,
      purchase_price_single: 119.00,
      sale_price_single: 198.30,
      base_price: 198.30,
      pack_size: 1,
      current_stock: 11,
      unit: "Syp",
      note: "Packing: 120 ML (10 Paid + 1 Bonus) | Margin: 40%",
      batch_number: "S-293",
      expiry_date: "2028-06-01"
    }
  ];

  for (const item of customInvoiceItems) {
    const brandId = brandMap.get(item.brand);

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("shop_id", WAZIM_SHOP_ID)
      .eq("name", item.name)
      .maybeSingle();

    let prodId = existing?.id;

    if (!prodId) {
      const { data: created } = await supabase
        .from("products")
        .insert({
          shop_id: WAZIM_SHOP_ID,
          brand_id: brandId,
          name: item.name,
          code: item.code,
          purchase_price_pack: item.purchase_price_pack,
          sale_price_pack: item.sale_price_pack,
          purchase_price_single: item.purchase_price_single,
          sale_price_single: item.sale_price_single,
          base_price: item.base_price,
          pack_size: item.pack_size,
          current_stock: item.current_stock,
          unit: item.unit,
          note: item.note
        })
        .select()
        .single();
      if (created) prodId = created.id;
    } else {
      await supabase
        .from("products")
        .update({
          brand_id: brandId,
          code: item.code,
          purchase_price_pack: item.purchase_price_pack,
          sale_price_pack: item.sale_price_pack,
          purchase_price_single: item.purchase_price_single,
          sale_price_single: item.sale_price_single,
          base_price: item.base_price,
          pack_size: item.pack_size,
          current_stock: item.current_stock,
          unit: item.unit,
          note: item.note
        })
        .eq("id", prodId);
    }

    if (prodId && item.batch_number) {
      await supabase
        .from("product_batches")
        .delete()
        .eq("product_id", prodId);

      await supabase
        .from("product_batches")
        .insert({
          shop_id: WAZIM_SHOP_ID,
          product_id: prodId,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          stock_quantity: item.current_stock,
          purchase_price: item.purchase_price_pack
        });
    }
  }

  console.log("Successfully seeded Wazim Pharmacy products & batches!");
}

main().catch(console.error);
