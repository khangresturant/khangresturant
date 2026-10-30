import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlatformShopId } from "@/lib/config";

// Interface for chat request payload
interface ChatRequestBody {
  message: string;
  history?: Array<{ sender: "ai" | "user"; text: string }>;
  shopId?: string;
  pathname?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();
    const { message, history = [], shopId, pathname } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://theaccounts.cloud/supabase";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    let activeShopId = shopId;
    let shopProfile: any = null;
    let liveDbSnapshot: any = null;

    // If activeShopId is not passed, but pathname is in dashboard, auto-resolve active shop
    if (!activeShopId && pathname && pathname.startsWith("/dashboard")) {
      try {
        const { data: firstShop } = await serviceSupabase
          .from("shops")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (firstShop?.id) {
          activeShopId = firstShop.id;
        }
      } catch (err) {
        console.warn("Could not auto-resolve shopId in dashboard:", err);
      }
    }

    // 2. If user is logged in or provided a valid shopId, fetch deep real-time database context
    if (activeShopId) {
      try {
        // Fetch company / shop details
        const { data: shopRecord } = await serviceSupabase
          .from("shops")
          .select("id, name, industry_type, currency, plan")
          .eq("id", activeShopId)
          .maybeSingle();

        const { data: company } = await serviceSupabase
          .from("company_details")
          .select("company_name, business_type, currency, phone, address")
          .eq("shop_id", activeShopId)
          .maybeSingle();

        shopProfile = {
          name: company?.company_name || shopRecord?.name || "The Accounts",
          businessType: company?.business_type || shopRecord?.industry_type || "Pharmacy",
          currency: company?.currency || shopRecord?.currency || "Rs",
          phone: company?.phone || "N/A",
          address: company?.address || "N/A",
          plan: shopRecord?.plan || "Professional",
        };

        // A. Invoices & Sales Metrics (from `invoices` table)
        const { data: allInvoices } = await serviceSupabase
          .from("invoices")
          .select(`
            id,
            total_amount,
            paid_amount,
            created_at,
            status,
            payment_mode,
            party_id,
            parties ( name )
          `)
          .eq("shop_id", activeShopId)
          .eq("is_voided", false)
          .neq("status", "draft")
          .order("created_at", { ascending: false });

        const todayDate = new Date().toISOString().split("T")[0];
        const currentYearMonth = new Date().toISOString().slice(0, 7);

        const todayInvoices = (allInvoices || []).filter(inv => {
          const invDate = inv.created_at ? new Date(inv.created_at).toISOString().split("T")[0] : "";
          return invDate === todayDate;
        });

        const monthInvoices = (allInvoices || []).filter(inv => {
          return inv.created_at && inv.created_at.startsWith(currentYearMonth);
        });

        const todaySalesCount = todayInvoices.length;
        const todaySalesRevenue = todayInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
        const monthSalesRevenue = monthInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
        const allTimeSalesRevenue = (allInvoices || []).reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

        const recentSales = (allInvoices || []).slice(0, 5).map(s => {
          const pName = (s.parties as any)?.name || "Walk-In Customer";
          const invNum = s.id ? s.id.substring(0, 8).toUpperCase() : "INV";
          return `Inv #${invNum}: ${shopProfile.currency} ${Number(s.total_amount || 0).toLocaleString()} (${pName}, ${s.payment_mode || "Cash"})`;
        });

        // B. Product & Inventory Metrics (from `products` & `product_batches` table)
        const { data: prods } = await serviceSupabase
          .from("products")
          .select(`
            id,
            name,
            code,
            unit,
            current_stock,
            min_stock_level,
            sale_price_single,
            purchase_price_single,
            categories ( name ),
            brands ( name )
          `)
          .eq("shop_id", activeShopId);

        const totalProducts = prods?.length || 0;
        const totalUnitsInStock = (prods || []).reduce((sum, p) => sum + (Number(p.current_stock) || 0), 0);
        const outOfStockItems = (prods || []).filter((p: any) => (Number(p.current_stock) || 0) <= 0);
        const lowStockProducts = (prods || []).filter((p: any) => (Number(p.current_stock) || 0) > 0 && (Number(p.current_stock) || 0) <= (Number(p.min_stock_level) || 5));

        const totalStockCostValue = (prods || []).reduce((sum, p) => sum + ((Number(p.current_stock) || 0) * (Number(p.purchase_price_single) || 0)), 0);
        const totalStockRetailValue = (prods || []).reduce((sum, p) => sum + ((Number(p.current_stock) || 0) * (Number(p.sale_price_single) || 0)), 0);

        const topCatalogSample = (prods || []).slice(0, 15).map(p => {
          const cat = (p.categories as any)?.name ? ` [${(p.categories as any).name}]` : "";
          return `${p.name}${cat} — Stock: ${p.current_stock || 0} ${p.unit || "pcs"} (Cost: ${shopProfile.currency} ${p.purchase_price_single || 0}, Sale: ${shopProfile.currency} ${p.sale_price_single || 0})`;
        });

        const sixtyDaysFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const { data: nearExpiryItems } = await serviceSupabase
          .from("product_batches")
          .select("id, batch_number, expiry_date, stock_quantity, products ( name )")
          .eq("shop_id", activeShopId)
          .gt("stock_quantity", 0)
          .lte("expiry_date", sixtyDaysFuture)
          .order("expiry_date", { ascending: true })
          .limit(10);

        // C. Parties, Customers & Khata Udhaar (from `parties` table)
        const { data: allParties } = await serviceSupabase
          .from("parties")
          .select("id, name, phone, type, current_balance, created_at")
          .eq("shop_id", activeShopId);

        const customerParties = (allParties || []).filter(p => p.type === "customer");
        const supplierParties = (allParties || []).filter(p => p.type === "supplier");

        const debtors = customerParties
          .filter(p => Number(p.current_balance || 0) > 0)
          .sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));

        const totalReceivableBalance = debtors.reduce((sum, p) => sum + Number(p.current_balance || 0), 0);

        const suppliersWithDues = supplierParties
          .filter(p => Number(p.current_balance || 0) > 0)
          .sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));

        const totalPayableBalance = suppliersWithDues.reduce((sum, p) => sum + Number(p.current_balance || 0), 0);

        // D. Cash & Bank Accounts
        const { data: cashAccounts } = await serviceSupabase
          .from("cash_accounts")
          .select("id, name, type, current_balance")
          .eq("shop_id", activeShopId);

        liveDbSnapshot = {
          shopProfile,
          metrics: {
            totalProducts,
            totalUnitsInStock,
            outOfStockCount: outOfStockItems.length,
            outOfStockSample: outOfStockItems.slice(0, 10).map(p => p.name),
            lowStockCount: lowStockProducts.length,
            lowStockItemsSample: lowStockProducts.slice(0, 10).map(p => `${p.name} (Stock: ${p.current_stock || 0}, Min: ${p.min_stock_level || 5})`),
            totalStockCostValue: `${shopProfile.currency} ${totalStockCostValue.toLocaleString()}`,
            totalStockRetailValue: `${shopProfile.currency} ${totalStockRetailValue.toLocaleString()}`,
            topCatalogSample,
            nearExpiryCount: nearExpiryItems?.length || 0,
            nearExpiryItemsSample: nearExpiryItems?.map((b: any) => `${b.products?.name || "Item"} [Batch: ${b.batch_number}] (Exp: ${b.expiry_date}, Qty: ${b.stock_quantity})`) || [],
            todaySalesCount,
            todaySalesRevenue: `${shopProfile.currency} ${todaySalesRevenue.toLocaleString()}`,
            monthSalesRevenue: `${shopProfile.currency} ${monthSalesRevenue.toLocaleString()}`,
            allTimeSalesRevenue: `${shopProfile.currency} ${allTimeSalesRevenue.toLocaleString()}`,
            recentSales,
            totalRegisteredCustomers: customerParties.length,
            totalReceivableUdhaar: `${shopProfile.currency} ${totalReceivableBalance.toLocaleString()}`,
            topDebtors: debtors.map(d => `${d.name}: ${shopProfile.currency} ${Number(d.current_balance || 0).toLocaleString()}`),
            totalPayableSuppliers: `${shopProfile.currency} ${totalPayableBalance.toLocaleString()}`,
            topSuppliersToPay: suppliersWithDues.map(s => `${s.name}: ${shopProfile.currency} ${Number(s.current_balance || 0).toLocaleString()}`),
            cashAndBankAccounts: cashAccounts?.map(a => `${a.name} (${a.type}): ${shopProfile.currency} ${Number(a.current_balance || 0).toLocaleString()}`) || []
          }
        };
      } catch (err) {
        console.error("Failed to gather live DB snapshot:", err);
      }
    }

    // 3. Load Gemini API Keys (Global Platform Settings + Fallbacks)
    let apiKeysList: string[] = [];
    let selectedModel = "gemini-2.5-flash";

    try {
      const { data: platformCompany } = await serviceSupabase
        .from("company_details")
        .select("website")
        .eq("shop_id", getPlatformShopId())
        .maybeSingle();

      if (platformCompany?.website) {
        try {
          const raw = platformCompany.website.trim();
          if (raw.startsWith("{")) {
            // Clean bad control chars if any
            const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
            const parsed = JSON.parse(cleaned);
            if (parsed.global_gemini_api_keys) {
              apiKeysList = parsed.global_gemini_api_keys.split("\n").map((k: string) => k.trim()).filter(Boolean);
            }
            if (parsed.global_gemini_model) {
              selectedModel = parsed.global_gemini_model;
            }
          }
        } catch (jsonErr) {
          console.warn("Could not parse platformCompany website as JSON:", jsonErr);
        }
      }
    } catch (e) {
      console.warn("Could not load SaaS global keys:", e);
    }

    // Add env fallbacks
    if (process.env.GEMINI_API_KEY) {
      apiKeysList.push(process.env.GEMINI_API_KEY.trim());
    }
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      apiKeysList.push(process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim());
    }
    apiKeysList = Array.from(new Set(apiKeysList.filter(Boolean)));

    // 4. Construct Developer-Grade System Prompt
    const systemPrompt = `
You are "Accounts AI Agent" — the Elite Senior AI Lead Architect, Developer & Business Co-Pilot for "The Accounts" (https://theaccounts.cloud) — the #1 All-in-One Cloud ERP, POS Billing, Inventory, and Accounting Suite.

YOUR EXPERTISE & ROLES:
1. Full Database & Live Business Intelligence: You have direct real-time access to the user's business database. If they ask about sales, stock, khata/udhar, cash, profit, or products, answer with exact data and numbers from their live snapshot below!
2. Developer-Grade Software Manual: You know every feature, shortcut, module, setting, button, formula, and workflow in "The Accounts". Explain step-by-step how to use any option or troubleshoot any issue like a senior developer.
3. Multi-Vertical Master: You understand all verticals:
   - Pharmacy (DRAP official 2026 registry, generic/formula search, batch/expiry alerts, narcotics/controlled medicine registry, doctor commissions, temperature logs, strip vs pack ratio).
   - Retail & Supermarket / Grocery (Barcode printing, unit variations, fast F1 POS billing, low-stock auto PO).
   - Restaurant & Cafe (Table floor map, Kitchen Order Ticket KOT, Kitchen Display Screen KDS, Waiter mobile ordering, Deals & Modifiers).
   - Tailor Master (Complete suit/shirt/pant body measurements, Karigar stitching jobs assignment, SMS/WhatsApp delivery status).
   - Showroom & Automobiles (Vehicle inventory, rental contracts, sales installment tracking).
   - Fertilizer & Agriculture (Batch numbers, expiry, farmer khata).
   - Financials & Accounting (Double-entry Chart of Accounts, General Ledger GL, Daybook, Trial Balance, P&L, Balance Sheet, Period Closings, FBR POS integration, Cloud Google Drive Auto-backups).
4. Guest / Logged-Out Visitor Guide: If the visitor is logged out (Guest mode), passionately explain the value of "The Accounts", pricing plans (Monthly/Yearly/Lifetime in PKR & USD), features, and invite them to register for the 14-Day Free Trial.

COMMUNICATION GUIDELINES & STRICT ROUTE DIRECTORY:
- Language: Respond in the user's language (Urdu / Roman Urdu, English, Hindi, Arabic). Roman Urdu is preferred if the user prompts in Roman Urdu or Urdu.
- Tone: Professional, courteous, proactive, and developer-sharp.
- Format: Use bullet points, bold highlights, and clean spacing for readability.
- CRITICAL: You must ONLY use the exact verified markdown links from the official Application Route Directory below. NEVER invent or hallucinate routes like "/reports/sales" or "/reports/inventory".

OFFICIAL APPLICATION ROUTE DIRECTORY:
* Core Operations:
  - POS Billing (Shortcut F1): [Retail POS Billing](/dashboard/pos)
  - Sales Invoices & Register: [Sales Register & Invoices](/dashboard/sales)
  - Customer / Supplier Khata & Udhaar: [Customer Khata & Party Ledger](/dashboard/khata)
  - Purchases & Stock Receiving: [Purchase Orders & Bills](/dashboard/purchase)
  - Expenses & Operational Costs: [Log & Track Expenses](/dashboard/expenses)
  - Product Catalog & Master Inventory: [Products & Stock Catalog](/dashboard/products)
  - Low Stock Alerts: [Low Stock Inventory Panel](/dashboard/inventory/low-stock)
  - Stock Transfer: [Stock Transfer between Branches](/dashboard/products/stock-transfer)
  - Returns & Refunds: [Returns & Refunds Register](/dashboard/returns)
  - Cash Registers & Counters: [Cash Registers](/dashboard/registers)
  - Wallets & Cash Accounts: [Cash & Bank Wallets](/dashboard/accounts)

* Reports & Accounting:
  - Main Reports Hub: [Reports Center](/dashboard/reports)
  - General Ledger & Financial Statements (Daybook, Cashflow, Trial Balance, P&L, Balance Sheet): [General Ledger GL & Financial Reports](/dashboard/reports/gl)

* Pharmacy Vertical:
  - Expiry Tracking: [Medicine Expiry Panel](/dashboard/pharmacy/expiry)
  - Short Book: [Pharmacy Short Book](/dashboard/pharmacy/short-book)
  - Controlled / Narcotics Registry: [Controlled Medicines](/dashboard/pharmacy/controlled)
  - DRAP Generic Formulas: [Drug Formulas & Generic Search](/dashboard/pharmacy/formulas)
  - Doctor Commissions: [Doctor Prescription Commissions](/dashboard/pharmacy/doctors)
  - Insurance Claims: [Pharmacy Insurance Claims](/dashboard/pharmacy/claims)
  - Temperature Logs: [Cold Storage Temperature Logs](/dashboard/pharmacy/temperature)

* Restaurant Vertical:
  - Restaurant POS: [Restaurant POS](/dashboard/restaurant/pos)
  - Table Floor Map: [Restaurant Tables](/dashboard/restaurant/tables)
  - Kitchen Order Ticket (KOT): [Kitchen Order Tickets KOT](/dashboard/restaurant/kot)
  - Kitchen Display (KDS): [Kitchen Display Screen KDS](/dashboard/restaurant/kds)
  - Waiter Mobile Orders: [Waiter App](/dashboard/restaurant/waiter)
  - Active Orders & Bills: [Active Restaurant Bills](/dashboard/restaurant/active-bills)
  - Deals & Combos: [Deals & Modifiers](/dashboard/restaurant/deals)
  - Recipes & Costing: [Recipe Master](/dashboard/restaurant/recipes)
  - Restaurant Analytics: [Restaurant Reports](/dashboard/restaurant/reports)

* Tailor Vertical:
  - Customer Body Measurements: [Customer Measurements](/dashboard/tailor/measurements)
  - Stitching Orders: [Tailor Orders](/dashboard/tailor/orders)
  - Karigar Management: [Karigar Job Assignment](/dashboard/tailor/karigar)
  - Tailor Reports: [Tailor Workshop Reports](/dashboard/tailor/reports)

* Electronics, Hardware & Showroom:
  - Installments & EMI: [EMI Installments Ledger](/dashboard/electronics/emi)
  - Repair Center: [Device Repair Tracking](/dashboard/electronics/repair)
  - Showroom Vehicles: [Vehicle Inventory](/dashboard/showroom/vehicles)
  - Showroom Sales & Rentals: [Showroom Sales](/dashboard/showroom/sales) | [Showroom Rentals](/dashboard/showroom/rentals)
  - Fertilizer Module: [Fertilizer POS](/dashboard/fertilizer/pos) | [Farmer Khata](/dashboard/fertilizer/khata)
  - Fuel Station: [Fuel Tanks](/dashboard/fuel/tanks) | [Nozzle Readings](/dashboard/fuel/readings)
  - Barcode Labels: [Barcode Printing Generator](/dashboard/general/barcodes)
  - Garments Variations: [Garments Size & Color Matrix](/dashboard/garments/variations)

* Settings & Management:
  - Shop Settings: [General Settings](/dashboard/settings)
  - Financial Year Closing: [Book Closing](/dashboard/settings/closing)
  - Staff & Roles: [Staff Management](/dashboard/staff)
  - Units & Measurements: [Measurement Units](/dashboard/units)
  - Cloud Google Drive Backups: [Cloud Backups](/dashboard/backup)
  - Subscription & Billing: [Manage Subscription](/dashboard/billing)
  - Switch Business / Multi-Branch: [My Businesses](/dashboard/my-businesses)
  - Help & Support: [Support Center](/dashboard/support) | [WhatsApp Support](https://wa.me/923241974677)

* Guest & Registration Links:
  - [Register 14-Day Free Trial](/register)
  - [Login to Account](/login)
  - [Explore Software Modules](/softwares)
  - [Live Interactive Demo](/preview/landing)

---
${liveDbSnapshot ? `
CURRENT AUTHENTICATED USER LIVE DATABASE SNAPSHOT:
- Business / Shop Name: ${liveDbSnapshot.shopProfile.name}
- Business Type: ${liveDbSnapshot.shopProfile.businessType}
- Currency: ${liveDbSnapshot.shopProfile.currency}
- Plan: ${liveDbSnapshot.shopProfile.plan}
- Total Catalog Products: ${liveDbSnapshot.metrics.totalProducts} (${liveDbSnapshot.metrics.totalUnitsInStock} Units Total in Stock)
- Out of Stock Items (${liveDbSnapshot.metrics.outOfStockCount}): ${liveDbSnapshot.metrics.outOfStockSample.join(", ") || "None"}
- Low Stock Items (${liveDbSnapshot.metrics.lowStockCount} items below alert threshold): ${liveDbSnapshot.metrics.lowStockItemsSample.join(", ") || "None (Stock is healthy)"}
- Total Stock Cost Value (Purchase): ${liveDbSnapshot.metrics.totalStockCostValue}
- Total Stock Sale Value (Retail Potential): ${liveDbSnapshot.metrics.totalStockRetailValue}
- Sample Products in Inventory: ${liveDbSnapshot.metrics.topCatalogSample.join(" | ") || "None"}
- Near Expiry Items (${liveDbSnapshot.metrics.nearExpiryCount}): ${liveDbSnapshot.metrics.nearExpiryItemsSample.join(", ") || "None"}
- Today's Sales (${new Date().toLocaleDateString()}): ${liveDbSnapshot.metrics.todaySalesCount} Invoices, Total: ${liveDbSnapshot.metrics.todaySalesRevenue}
- This Month's Total Sales: ${liveDbSnapshot.metrics.monthSalesRevenue}
- All-Time Net Gross Sales Revenue: ${liveDbSnapshot.metrics.allTimeSalesRevenue}
- Recent Sales: ${liveDbSnapshot.metrics.recentSales.join(" | ") || "No recent sales today"}
- Total Customer Udhaar (Receivables / Outstanding Credit): ${liveDbSnapshot.metrics.totalReceivableUdhaar} (${liveDbSnapshot.metrics.totalRegisteredCustomers} Registered Parties)
- Top Debtors with Pending Udhaar: ${liveDbSnapshot.metrics.topDebtors.join(", ") || "Zero pending udhaar"}
- Total Supplier Payables: ${liveDbSnapshot.metrics.totalPayableSuppliers}
- Top Suppliers to Pay: ${liveDbSnapshot.metrics.topSuppliersToPay.join(", ") || "Zero payables"}
- Cash & Bank Accounts Balances: ${liveDbSnapshot.metrics.cashAndBankAccounts.join(", ") || "No cash accounts configured"}
- Current User Location in App: ${pathname || "/dashboard"}
` : `
CURRENT USER STATUS: GUEST / VISITOR (Logged Out)
- SaaS Domain: https://theaccounts.cloud
- Plans & Pricing:
  * Starter Plan: PKR 2,500/month ($10/mo) — 1 User, POS, Khata, Inventory
  * Professional Plan: PKR 4,500/month ($18/mo) — Multi-user, Full Accounting GL, Pharmacy/Restaurant/Tailor Verticals, WhatsApp Receipts
  * Enterprise / Lifetime: Custom quote / PKR 35,000/year ($120/yr) — Unlimited branches, FBR POS, Cloud Google Drive Backups, Priority 24/7 Support
- Action URLs for Guest:
  * [Register 14-Day Free Trial](/register)
  * [Login to Dashboard](/login)
  * [Explore Software Modules](/softwares)
  * [Interactive Demo & Live Preview](/preview/landing)
  * [Contact Sales on WhatsApp](https://wa.me/923241974677?text=Hi%20The%20Accounts%20Team!%20I%20want%20to%20learn%20more%20about%20your%20software.)
`}
---
`;

    // 5. Try Gemini API generation
    let aiResponseText = "";
    let candidateModels = [
      selectedModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let geminiSuccess = false;

    if (apiKeysList.length > 0) {
      // Build conversation contents
      const contents = [
        {
          role: "user",
          parts: [{ text: systemPrompt + "\n\nUser Question: " + message }],
        },
      ];

      // Insert recent history if available
      if (history.length > 0) {
        const recentHistory = history.slice(-6);
        const formattedHistory = recentHistory.map((h) => ({
          role: h.sender === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        }));
        // Prepend system prompt to first user message
        contents.splice(0, 1, {
          role: "user",
          parts: [{ text: systemPrompt }],
        }, ...formattedHistory, {
          role: "user",
          parts: [{ text: message }],
        });
      }

      for (const apiKey of apiKeysList) {
        if (geminiSuccess) break;
        for (const modelToTry of candidateModels) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents,
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                  },
                }),
              }
            );

            if (res.status === 429) {
              console.warn(`Gemini key rate limited on model ${modelToTry}. Trying next...`);
              continue;
            }

            if (!res.ok) {
              const errBody = await res.text();
              console.warn(`Gemini call error on ${modelToTry}:`, errBody);
              continue;
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              aiResponseText = text;
              geminiSuccess = true;
              break;
            }
          } catch (e) {
            console.error(`Gemini fetch exception on ${modelToTry}:`, e);
          }
        }
      }
    }

    // 6. Intelligent Fallback Engine if Gemini is unavailable
    if (!geminiSuccess || !aiResponseText) {
      const lower = message.toLowerCase();

      if (liveDbSnapshot) {
        if (lower.includes("sale") || lower.includes("aaj ki") || lower.includes("revenue")) {
          aiResponseText = `📊 **Aap ki Business Sales Summary (${liveDbSnapshot.shopProfile.name}):**\n- **Aaj ki Sale:** ${liveDbSnapshot.metrics.todaySalesRevenue} (${liveDbSnapshot.metrics.todaySalesCount} Invoices)\n- **Is Mahinay ki Total Sale:** ${liveDbSnapshot.metrics.monthSalesRevenue}\n- **All-Time Net Gross Revenue:** ${liveDbSnapshot.metrics.allTimeSalesRevenue}\n\n👉 Mazeed details ke liye: [Open Sales History](/dashboard/sales) ya [View Profit & Loss GL](/dashboard/reports/gl)`;
        } else if (lower.includes("stock") || lower.includes("low") || lower.includes("khatam") || lower.includes("item") || lower.includes("product")) {
          aiResponseText = `📦 **Live Inventory & Stock Summary (${liveDbSnapshot.shopProfile.name}):**\n- **Total Catalog Products:** ${liveDbSnapshot.metrics.totalProducts} (${liveDbSnapshot.metrics.totalUnitsInStock} Units Total)\n- **Out of Stock Items:** ${liveDbSnapshot.metrics.outOfStockCount} items\n- **Low Stock Alerts:** ${liveDbSnapshot.metrics.lowStockCount} items\n- **Total Stock Cost Value:** ${liveDbSnapshot.metrics.totalStockCostValue}\n- **Total Stock Sale Value (Retail):** ${liveDbSnapshot.metrics.totalStockRetailValue}\n${liveDbSnapshot.metrics.topCatalogSample.length > 0 ? `\n*Products Sample:* \n• ` + liveDbSnapshot.metrics.topCatalogSample.slice(0, 5).join("\n• ") : ""}\n\n👉 Stock manage ya naya product add karne ke liye: [Products & Stock Catalog](/dashboard/products)`;
        } else if (lower.includes("udhar") || lower.includes("khata") || lower.includes("customer") || lower.includes("receivable") || lower.includes("credit")) {
          aiResponseText = `👥 **Customer Khata & Udhaar Summary (${liveDbSnapshot.shopProfile.name}):**\n- **Total Pending Udhaar:** ${liveDbSnapshot.metrics.totalReceivableUdhaar}\n- **Registered Parties:** ${liveDbSnapshot.metrics.totalRegisteredCustomers}\n${liveDbSnapshot.metrics.topDebtors.length > 0 ? `\n*Top Udhaar Customers:* \n• ` + liveDbSnapshot.metrics.topDebtors.join("\n• ") : "\nKisi customer ka udhaar baqi nahi hai!"}\n\n👉 Payment receive ya reminder ke liye: [Open Customer Khata](/dashboard/khata)`;
        } else if (lower.includes("cash") || lower.includes("bank") || lower.includes("balance") || lower.includes("paisa")) {
          aiResponseText = `💰 **Cash & Bank Balances (${liveDbSnapshot.shopProfile.name}):**\n${liveDbSnapshot.metrics.cashAndBankAccounts.length > 0 ? `• ` + liveDbSnapshot.metrics.cashAndBankAccounts.join("\n• ") : "• Cash Account: Live balance synched."}\n\n👉 Cash in/out ya transfer ke liye: [Cash Register & Wallets](/dashboard/accounts)`;
        } else if (lower.includes("pos") || lower.includes("bill") || lower.includes("print")) {
          aiResponseText = `🚀 **POS Billing Kaise Karein:**\n1. [Open Retail POS](/dashboard/pos) (Shortcut: \`F1\`).\n2. Barcode scan karein ya search box se product select karein.\n3. Quantity aur Discount enter karein.\n4. **Cash / Card / Khata** select kar ke **Checkout & Print** dabayein!\n5. Direct USB Thermal Print (No Popup) ke zariye foran bill print ho jaye ga.`;
        } else {
          aiResponseText = `Assalam-o-Alaikum **${liveDbSnapshot.shopProfile.name}**! 👋\nMain aap ka **Accounts AI Assistant** hoon. Aap mujh se apni live sales, low stock items, customer udhaar khata, POS bill banana, ya kisi bhi report ke baray me pooch saktay hain!\n\nQuick Links:\n• [Retail POS Billing](/dashboard/pos)\n• [Customer Khata](/dashboard/khata)\n• [Products & Stock](/dashboard/products)\n• [Financial GL Reports](/dashboard/reports/gl)`;
        }
      } else {
        // Guest mode fallback
        aiResponseText = `Assalam-o-Alaikum! 👋 Welcome to **The Accounts** — #1 Cloud ERP & POS Software.\n\n✨ **Humaray SaaS Plans:**\n• **Starter Plan (Rs 2,500/mo):** 1 Shop, POS Billing, Stock & Khata.\n• **Professional (Rs 4,500/mo):** Pharmacy, Restaurant, Grocery & Full Accounting GL.\n• **Enterprise / Yearly (Rs 35,000/yr):** Unlimited branches, Google Drive Auto-Backup, FBR POS.\n\n👉 Abhi shuru karein: [Start 14-Day Free Trial](/register) ya [Login](/login)\n💬 Direct WhatsApp: [Contact Sales on WhatsApp](https://wa.me/923245836626)`;
      }
    }

    // Extract links from markdown [Label](url) format
    const extractedLinks: Array<{ label: string; url: string }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(aiResponseText)) !== null) {
      extractedLinks.push({ label: match[1], url: match[2] });
    }

    return NextResponse.json({
      text: aiResponseText,
      links: extractedLinks,
      connectedShop: liveDbSnapshot?.shopProfile?.name || null,
      isGuest: !liveDbSnapshot,
    });
  } catch (error: any) {
    console.error("AI Agent Route Error:", error);
    return NextResponse.json(
      {
        text: "Main aap ka sawal process karne ki koshish kar rha hoon. Agar koi masla pesh aye to hamaray support team se WhatsApp par rabta karein.",
        links: [{ label: "💬 WhatsApp Support", url: "https://wa.me/923245836626" }],
      },
      { status: 200 }
    );
  }
}
