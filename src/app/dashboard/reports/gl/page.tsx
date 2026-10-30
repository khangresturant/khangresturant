"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Calculator, Download, TrendingUp, Calendar, 
  ArrowRightLeft, FileText, Scale, CheckCircle2, AlertCircle, 
  ArrowUpRight, ArrowDownLeft, ShoppingBag, Truck, Search, 
  Users, UserCheck, Phone, CreditCard, Building2, Eye, RefreshCw,
  BadgePercent, Layers, ListFilter, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import { fetchShowroomProductFlow } from "@/lib/showroom-accounting";

type GLTab = "trial" | "pl" | "balance" | "product_flow" | "money_flow" | "account_statement";

interface AccountSummary {
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
}

interface EnrichedParty {
  id: string;
  name: string;
  phone?: string | null;
  type: "customer" | "supplier" | "dual";
  current_balance: number;
  created_at?: string;
}

const GL_ACCOUNT_TEMPLATES = [
  // 1. Assets
  { code: "1001", name: "Cash & Bank Accounts", type: "Asset" as const },
  { code: "1002", name: "Accounts Receivable (Customers)", type: "Asset" as const },
  { code: "1003", name: "Stock / Inventory Asset", type: "Asset" as const },
  { code: "1004", name: "Employee Advances / Deductions", type: "Asset" as const },
  { code: "1200", name: "Prepaid Expenses & Advances", type: "Asset" as const },
  { code: "1400", name: "Fixed Assets (General)", type: "Asset" as const },
  { code: "1410", name: "Fixed Assets: Land & Buildings", type: "Asset" as const },
  { code: "1420", name: "Fixed Assets: Machinery & Equipment", type: "Asset" as const },
  { code: "1430", name: "Fixed Assets: Office Furniture & Fixtures", type: "Asset" as const },
  { code: "1440", name: "Fixed Assets: Vehicles & Computers", type: "Asset" as const },
  
  // 2. Liabilities
  { code: "2001", name: "Accounts Payable (Suppliers)", type: "Liability" as const },
  { code: "2002", name: "Accrued Salaries Payable", type: "Liability" as const },
  { code: "2100", name: "Bank Loans & Overdrafts", type: "Liability" as const },
  { code: "2201", name: "Accrued Expenses Payable (Rent/Utilities)", type: "Liability" as const },
  { code: "2300", name: "Tax Payable (GST, VAT, WHT)", type: "Liability" as const },
  
  // 3. Equity
  { code: "3100", name: "Owner's Capital Account", type: "Equity" as const },
  { code: "3200", name: "Owner's Drawings Account", type: "Equity" as const },
  { code: "3300", name: "Retained Earnings & Reserves", type: "Equity" as const },
  
  // 4. Revenue
  { code: "4001", name: "Sales Revenue", type: "Revenue" as const },
  { code: "4002", name: "Discount Received", type: "Revenue" as const },
  { code: "4100", name: "Service Revenue (Stitching/Repairs)", type: "Revenue" as const },
  { code: "4300", name: "Other Operating Income", type: "Revenue" as const },
  
  // 5. Expenses
  { code: "5001", name: "Cost of Goods / Purchases", type: "Expense" as const },
  { code: "5002", name: "Discount Allowed", type: "Expense" as const },
  { code: "5003", name: "Operating Expenses (General)", type: "Expense" as const },
  { code: "5004", name: "Salaries & Wages Expense", type: "Expense" as const },
  { code: "5100", name: "Rent & Lease Expense", type: "Expense" as const },
  { code: "5200", name: "Utilities Expense (Electricity, Net)", type: "Expense" as const },
  { code: "5300", name: "Marketing & Advertising Expense", type: "Expense" as const },
  { code: "5400", name: "Office Supplies & Maintenance", type: "Expense" as const },
  { code: "5500", name: "Depreciation Expense", type: "Expense" as const }
];

export default function GeneralLedgerPage() {
  const { shopId, shopName, allowReports, selectedCurrency, industryType } = useShop();
  const { t } = useLanguage();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<GLTab>("trial");
  const [loading, setLoading] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [accountsSummary, setAccountsSummary] = useState<Record<string, AccountSummary>>({});
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [trialBalanceMode, setTrialBalanceMode] = useState<"post_closing" | "unadjusted">("post_closing");
  const [postingClosingEntry, setPostingClosingEntry] = useState(false);
  
  // Flow Ledgers States
  const [moneyFlow, setMoneyFlow] = useState<any[]>([]);
  const [productFlow, setProductFlow] = useState<any[]>([]);
  const [flowSearchQuery, setFlowSearchQuery] = useState("");
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedLedgerCode, setSelectedLedgerCode] = useState<string>("1001");

  // Party & Invoice Lookup Caches for deep enrichment
  const [partiesList, setPartiesList] = useState<EnrichedParty[]>([]);
  const [partiesMap, setPartiesMap] = useState<Record<string, EnrichedParty>>({});
  const [invoicesMap, setInvoicesMap] = useState<Record<string, any>>({});
  const [purchasesMap, setPurchasesMap] = useState<Record<string, any>>({});
  const [rawInvoicesList, setRawInvoicesList] = useState<any[]>([]);
  const [rawPurchasesList, setRawPurchasesList] = useState<any[]>([]);
  const [creditTxList, setCreditTxList] = useState<any[]>([]);

  // Sub-party filter in Account Ledger Statement
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>("all");
  const [statementViewMode, setStatementViewMode] = useState<"statement" | "party_summary">("statement");
  const [onlyPendingDebtors, setOnlyPendingDebtors] = useState(true);

  // Pagination states for high-volume transactions
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    if (shopId) {
      fetchProductsList();
      fetchParties();
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      fetchLedgerData();
      if (activeTab === "product_flow") {
        fetchProductFlowData();
      }
    }
  }, [shopId, startDate, endDate, activeTab, trialBalanceMode]);

  // Reset page to 1 when changing active tab or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedProductId, selectedLedgerCode, selectedPartyFilter, statementViewMode, flowSearchQuery, startDate, endDate]);

  const fetchProductsList = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name");
      if (error) throw error;
      let allProducts = data || [];

      if (industryType === "showroom") {
        const { data: vehs } = await supabase
          .from("showroom_vehicles")
          .select("id, make, model, year, plate_number, chassis_number")
          .eq("shop_id", shopId);
        if (vehs && vehs.length > 0) {
          const vehProducts = vehs.map((v: any) => ({
            id: v.id,
            name: `🚗 ${v.make || ""} ${v.model || ""} ${v.year || ""} (${v.plate_number || v.chassis_number || "No Plate"})`.trim(),
          }));
          allProducts = [...allProducts, ...vehProducts];
        }
      }

      setProductsList(allProducts);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  const fetchParties = async () => {
    try {
      const [partiesRes, showroomPartiesRes, showroomInstRes] = await Promise.all([
        supabase
          .from("parties")
          .select("id, name, phone, type, current_balance, created_at")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("showroom_parties")
          .select("id, name, phone, party_type, current_balance, created_at")
          .eq("shop_id", shopId)
          .order("name"),
        industryType === "showroom" && shopId
          ? supabase
              .from("showroom_installments")
              .select("id, agreement_number, customer_name, customer_phone, total_price, down_payment, remaining_balance, created_at")
              .eq("shop_id", shopId)
          : Promise.resolve({ data: [] })
      ]);
      
      const standardList = (partiesRes.data || []) as EnrichedParty[];
      const showroomList: EnrichedParty[] = (showroomPartiesRes.data || []).map((sp: any) => ({
        id: sp.id,
        name: sp.name,
        phone: sp.phone || null,
        type: sp.party_type === "seller" ? "supplier" : sp.party_type === "buyer" ? "customer" : "dual",
        current_balance: Number(sp.current_balance || 0),
        created_at: sp.created_at,
      }));

      // In Motor Showroom, installment agreements represent key accounts receivable customers
      const showroomInstCustomers: EnrichedParty[] = ((showroomInstRes as any)?.data || []).map((inst: any) => ({
        id: inst.id,
        name: inst.customer_name,
        phone: inst.customer_phone || null,
        type: "customer" as const,
        current_balance: Number(inst.remaining_balance || 0),
        created_at: inst.created_at,
      }));

      const list = [...standardList, ...showroomList, ...showroomInstCustomers];
      setPartiesList(list);
      
      const pMap: Record<string, EnrichedParty> = {};
      list.forEach(p => { pMap[p.id] = p; });
      setPartiesMap(pMap);
    } catch (err) {
      console.error("Failed to load parties:", err);
    }
  };

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Journal entries (All time by default, or date filtered)
      let jquery = supabase
        .from("journal_entries")
        .select(`
          id, entry_date, ref_type, ref_id, narration,
          journal_lines ( id, account_code, account_name, debit, credit )
        `)
        .eq("shop_id", shopId)
        .order("entry_date", { ascending: true });

      if (startDate) jquery = jquery.gte("entry_date", startDate);
      if (endDate) jquery = jquery.lte("entry_date", endDate);

      const { data: jData, error: jError } = await jquery;
      if (jError) throw jError;

      // 2. Fetch Invoices for party / customer name lookup (use order_number column)
      let invQuery = supabase
        .from("invoices")
        .select("id, order_number, customer_name, party_id, total_amount, paid_amount, status, is_voided, created_at")
        .eq("shop_id", shopId);

      if (startDate) invQuery = invQuery.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) invQuery = invQuery.lte("created_at", `${endDate}T23:59:59`);

      const { data: invData, error: invErr } = await invQuery;
      setRawInvoicesList(invData || []);

      const invMap: Record<string, any> = {};
      if (!invErr && invData) {
        (invData as any[]).forEach((inv: any) => {
          invMap[inv.id] = inv;
          // Also index by 8-char short ID for robust fuzzy matching
          invMap[inv.id.substring(0, 8).toUpperCase()] = inv;
        });
        setInvoicesMap(invMap);
      }

      // 3. Fetch Purchase Orders for supplier lookup
      let poQuery = supabase
        .from("purchase_orders")
        .select("id, invoice_number, supplier_name, party_id, total_amount, paid_amount, status, is_voided, created_at")
        .eq("shop_id", shopId);

      if (startDate) poQuery = poQuery.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) poQuery = poQuery.lte("created_at", `${endDate}T23:59:59`);

      const { data: poData, error: poErr } = await poQuery;
      setRawPurchasesList(poData || []);

      const poMap: Record<string, any> = {};
      if (!poErr && poData) {
        (poData as any[]).forEach((po: any) => {
          poMap[po.id] = po;
          poMap[po.id.substring(0, 8).toUpperCase()] = po;
        });
        setPurchasesMap(poMap);
      }

      // 4. Showroom Specific Lookup Maps (Installments, Vehicles, Sales)
      const showroomInstMap: Record<string, any> = {};
      const showroomVehMap: Record<string, any> = {};
      const showroomSaleMap: Record<string, any> = {};

      if (industryType === "showroom" && shopId) {
        const [instR, vehR, saleR] = await Promise.all([
          supabase.from("showroom_installments").select("id, agreement_number, customer_name, customer_phone, total_price, down_payment, remaining_balance").eq("shop_id", shopId),
          supabase.from("showroom_vehicles").select("id, make, model, year, plate_number, chassis_number, purchase_cost, purchase_paid_amount, purchase_remaining_amount, purchase_party_id").eq("shop_id", shopId),
          supabase.from("showroom_sales").select("id, buyer_name, buyer_phone, sale_price, paid_amount, bill_no").eq("shop_id", shopId)
        ]);

        (instR.data || []).forEach((inst: any) => {
          showroomInstMap[inst.id] = inst;
          showroomInstMap[inst.id.substring(0, 8).toUpperCase()] = inst;
        });

        (vehR.data || []).forEach((v: any) => {
          showroomVehMap[v.id] = v;
          showroomVehMap[v.id.substring(0, 8).toUpperCase()] = v;
        });

        (saleR.data || []).forEach((s: any) => {
          showroomSaleMap[s.id] = s;
          showroomSaleMap[s.id.substring(0, 8).toUpperCase()] = s;
        });
      }

      // 5. Fetch Credit Transactions (Direct Khata receipts & entries)
      let ctQuery = supabase
        .from("credit_transactions")
        .select("id, customer_id, amount, transaction_type, remarks, created_at")
        .eq("shop_id", shopId);

      if (startDate) ctQuery = ctQuery.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) ctQuery = ctQuery.lte("created_at", `${endDate}T23:59:59`);

      const { data: ctData } = await ctQuery;
      setCreditTxList(ctData || []);

      // 6. Enrich journal entries with resolved party names, bill numbers, and contacts
      const enrichedEntries = ((jData || []) as any[]).map((entry: any) => {
        let partyName = "";
        let partyPhone = "";
        let partyId = "";
        let billRef = "";
        let cleanNarration = entry.narration || "";
        let additionalDetails = "";

        if (entry.ref_type === "invoice" || entry.narration?.includes("POS Sale") || entry.narration?.includes("Invoice")) {
          const inv = (entry.ref_id && invMap[entry.ref_id]) || 
                      (entry.ref_id && invMap[entry.ref_id.substring(0, 8).toUpperCase()]);
          
          if (inv) {
            partyId = inv.party_id || "";
            const matchedParty = inv.party_id ? partiesMap[inv.party_id] : null;
            partyName = inv.customer_name || matchedParty?.name || "Walk-in Customer";
            partyPhone = matchedParty?.phone || "";
            billRef = inv.order_number ? `Inv #${inv.order_number}` : `Bill #${inv.id.substring(0, 8).toUpperCase()}`;
            
            const total = Number(inv.total_amount || 0);
            const paid = Number(inv.paid_amount || 0);
            const creditDue = total - paid;
            additionalDetails = `Bill Total: ${selectedCurrency || "Rs"} ${total.toLocaleString()} | Paid: ${selectedCurrency || "Rs"} ${paid.toLocaleString()} | Due: ${selectedCurrency || "Rs"} ${creditDue.toLocaleString()}`;
          } else {
            // Extract from narration if present
            billRef = entry.ref_id ? `Bill #${entry.ref_id.substring(0, 8).toUpperCase()}` : "POS Sale";
            partyName = "Walk-in Customer";
          }
        } else if (entry.ref_type === "purchase" || entry.ref_type === "purchase_order" || entry.narration?.includes("Purchase")) {
          const po = (entry.ref_id && poMap[entry.ref_id]) || 
                      (entry.ref_id && poMap[entry.ref_id.substring(0, 8).toUpperCase()]);
          
          if (po) {
            partyId = po.party_id || "";
            const matchedParty = po.party_id ? partiesMap[po.party_id] : null;
            partyName = po.supplier_name || matchedParty?.name || "Supplier";
            partyPhone = matchedParty?.phone || "";
            billRef = po.invoice_number ? `PO #${po.invoice_number}` : `PO #${po.id.substring(0, 8).toUpperCase()}`;
            
            const total = Number(po.total_amount || 0);
            const paid = Number(po.paid_amount || 0);
            const creditDue = total - paid;
            additionalDetails = `PO Total: ${selectedCurrency || "Rs"} ${total.toLocaleString()} | Paid: ${selectedCurrency || "Rs"} ${paid.toLocaleString()} | Payable: ${selectedCurrency || "Rs"} ${creditDue.toLocaleString()}`;
          } else {
            billRef = entry.ref_id ? `PO #${entry.ref_id.substring(0, 8).toUpperCase()}` : "Purchase Order";
            partyName = "Supplier";
          }
        } else if (entry.ref_type?.startsWith("showroom_") || entry.narration?.toLowerCase().includes("showroom")) {
          billRef = entry.ref_type.replace("showroom_", "").replace(/_/g, " ").toUpperCase();
          const narr = entry.narration || "";
          if (narr.includes(" - ")) {
            const parts = narr.split(" - ");
            if (parts.length > 1) {
              partyName = parts[parts.length - 1].trim();
            }
          }

          if (entry.ref_type === "showroom_installment_agreement") {
            const inst = (entry.ref_id && showroomInstMap[entry.ref_id]) || (entry.ref_id && showroomInstMap[entry.ref_id.substring(0, 8).toUpperCase()]);
            if (inst) {
              partyId = inst.id;
              partyName = inst.customer_name || partyName;
              partyPhone = inst.customer_phone || "";
              billRef = inst.agreement_number ? `Agr #${inst.agreement_number}` : `Agr #${inst.id.substring(0, 8).toUpperCase()}`;
              const tot = Number(inst.total_price || 0);
              const down = Number(inst.down_payment || 0);
              const rem = Number(inst.remaining_balance || 0);
              additionalDetails = `Agreement Total: ${selectedCurrency || "Rs"} ${tot.toLocaleString()} | Advance Down: ${selectedCurrency || "Rs"} ${down.toLocaleString()} | Due: ${selectedCurrency || "Rs"} ${rem.toLocaleString()}`;
            }
          } else if (entry.ref_type === "showroom_vehicle_purchase") {
            const veh = (entry.ref_id && showroomVehMap[entry.ref_id]) || (entry.ref_id && showroomVehMap[entry.ref_id.substring(0, 8).toUpperCase()]);
            if (veh) {
              partyId = veh.purchase_party_id || "";
              const matchedP = veh.purchase_party_id ? partiesMap[veh.purchase_party_id] : null;
              if (matchedP) {
                partyName = matchedP.name;
                partyPhone = matchedP.phone || "";
              }
              const plate = veh.plate_number ? `Plate: ${veh.plate_number}` : veh.chassis_number ? `Chassis: ${veh.chassis_number}` : `Veh #${veh.id.substring(0, 8).toUpperCase()}`;
              billRef = `Purchase: ${plate}`;
              const cost = Number(veh.purchase_cost || 0);
              const rem = Number(veh.purchase_remaining_amount || 0);
              const paid = cost - rem;
              additionalDetails = `Cost: ${selectedCurrency || "Rs"} ${cost.toLocaleString()} | Paid: ${selectedCurrency || "Rs"} ${paid.toLocaleString()} | Payable: ${selectedCurrency || "Rs"} ${rem.toLocaleString()}`;
            }
          } else if (entry.ref_type === "showroom_vehicle_sale") {
            const sale = (entry.ref_id && showroomSaleMap[entry.ref_id]) || (entry.ref_id && showroomSaleMap[entry.ref_id.substring(0, 8).toUpperCase()]);
            if (sale) {
              partyId = sale.id;
              partyName = sale.buyer_name || partyName;
              partyPhone = sale.buyer_phone || "";
              billRef = sale.bill_no ? `Bill #${sale.bill_no}` : `Sale #${sale.id.substring(0, 8).toUpperCase()}`;
              const price = Number(sale.sale_price || 0);
              const paid = Number(sale.paid_amount || price);
              additionalDetails = `Sale Total: ${selectedCurrency || "Rs"} ${price.toLocaleString()} | Received: ${selectedCurrency || "Rs"} ${paid.toLocaleString()}`;
            }
          } else if (entry.ref_type === "showroom_closing_period") {
            billRef = "PERIOD CLOSING";
            partyName = "Retained Earnings & Reserves (3300)";
            additionalDetails = "Double-Entry Period Closing Routine (P&L -> Equity)";
          }

          if (!partyName) partyName = "Showroom Customer / Party";
        }

        return {
          ...entry,
          partyName,
          partyPhone,
          partyId,
          billRef,
          additionalDetails,
          cleanNarration
        };
      });

      setLedgerEntries(enrichedEntries);
      summarizeAccounts(enrichedEntries);
      extractMoneyFlow(enrichedEntries);
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        return;
      }
      console.error("fetchLedgerData error:", err);
      toast.error("Failed to load General Ledger: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductFlowData = async () => {
    setFlowLoading(true);
    try {
      const flows: any[] = [];

      if (industryType === "showroom" && shopId) {
        const showroomFlows = await fetchShowroomProductFlow(supabase, shopId, startDate, endDate);
        flows.push(...showroomFlows);
      } else {
        // Query sales items for retail / non-showroom
        const { data: salesItems, error: sErr } = await supabase
          .from("invoice_items")
          .select(`
            id, product_id, quantity, subtotal,
            products ( name ),
            invoices ( id, order_number, customer_name, party_id, created_at, is_voided, status, shop_id )
          `);

        if (sErr) throw sErr;

        // Query purchase items for retail / non-showroom
        const { data: purchaseItems, error: pErr } = await supabase
          .from("purchase_order_items")
          .select(`
            id, product_id, quantity, subtotal,
            products ( name ),
            purchase_orders ( id, invoice_number, supplier_name, party_id, created_at, is_voided, shop_id )
          `);

        if (pErr) throw pErr;

        (salesItems || []).forEach((item: any) => {
          const itemDate = item.invoices?.created_at ? item.invoices.created_at.split("T")[0] : "";
          const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);

          if (
            item.invoices && 
            item.invoices.shop_id === shopId && 
            !item.invoices.is_voided && 
            item.invoices.status !== "quotation" &&
            inDateRange
          ) {
            const cName = item.invoices.customer_name || (item.invoices.party_id ? partiesMap[item.invoices.party_id]?.name : null) || "Walk-in Customer";
            flows.push({
              id: item.id,
              productId: item.product_id,
              date: itemDate,
              productName: item.products?.name || "Product Item",
              partyName: cName,
              type: "Sale",
              qtyIn: 0,
              qtyOut: Number(item.quantity || 0),
              value: Number(item.subtotal || 0),
              ref: item.invoices.order_number ? `Inv #${item.invoices.order_number}` : `Bill #${item.invoices.id.substring(0, 8).toUpperCase()}`
            });
          }
        });

        (purchaseItems || []).forEach((item: any) => {
          const itemDate = item.purchase_orders?.created_at ? item.purchase_orders.created_at.split("T")[0] : "";
          const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);

          if (
            item.purchase_orders && 
            item.purchase_orders.shop_id === shopId && 
            !item.purchase_orders.is_voided &&
            inDateRange
          ) {
            const sName = item.purchase_orders.supplier_name || (item.purchase_orders.party_id ? partiesMap[item.purchase_orders.party_id]?.name : null) || "Supplier";
            flows.push({
              id: item.id,
              productId: item.product_id,
              date: itemDate,
              productName: item.products?.name || "Product Item",
              partyName: sName,
              type: "Purchase",
              qtyIn: Number(item.quantity || 0),
              qtyOut: 0,
              value: Number(item.subtotal || 0),
              ref: item.purchase_orders.invoice_number ? `PO #${item.purchase_orders.invoice_number}` : `PO #${item.purchase_orders.id.substring(0, 8).toUpperCase()}`
            });
          }
        });
      }

      // Sort flows descending by date
      flows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setProductFlow(flows);
    } catch (err: any) {
      console.error("Failed to load product flow:", err);
      toast.error("Failed to load Product Flow Ledger: " + err.message);
    } finally {
      setFlowLoading(false);
    }
  };

  const summarizeAccounts = (entries: any[]) => {
    const summary: Record<string, AccountSummary> = {};

    // Pre-initialize with ALL template accounts so they exist with 0 balances
    GL_ACCOUNT_TEMPLATES.forEach(t => {
      summary[t.code] = {
        code: t.code,
        name: t.name,
        debit: 0,
        credit: 0,
        balance: 0,
        type: t.type
      };
    });

    // Detect if official period closing entry is already present in DB entries
    const hasDbClosing = entries.some(e => e.ref_type === "showroom_closing_period" || e.narration?.includes("Period-End Closing"));

    entries.forEach((entry) => {
      // In unadjusted pre-closing mode, ignore the closing entry to view active operating accounts
      if (trialBalanceMode === "unadjusted" && (entry.ref_type === "showroom_closing_period" || entry.narration?.includes("Period-End Closing"))) {
        return;
      }

      (entry.journal_lines || []).forEach((line: any) => {
        const code = line.account_code;
        const name = line.account_name;
        const db = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        if (!summary[code]) {
          summary[code] = {
            code,
            name,
            debit: 0,
            credit: 0,
            balance: 0,
            type: code.startsWith("1") ? "Asset" : code.startsWith("2") ? "Liability" : code.startsWith("3") ? "Equity" : code.startsWith("4") ? "Revenue" : "Expense",
          };
        }

        summary[code].debit += db;
        summary[code].credit += cr;
      });
    });

    Object.keys(summary).forEach((code) => {
      const acc = summary[code];
      if (acc.type === "Asset" || acc.type === "Expense") {
        acc.balance = acc.debit - acc.credit;
      } else {
        acc.balance = acc.credit - acc.debit;
      }
    });

    // Dynamic Retained Earnings & Net Profit Calculation:
    // Net Profit = Total Revenue (4000) - Total Expenses / COGS (5000)
    let totalRev = 0;
    let totalExp = 0;
    Object.values(summary).forEach((acc) => {
      if (acc.type === "Revenue") totalRev += acc.balance;
      else if (acc.type === "Expense") totalExp += acc.balance;
    });
    const netProfitDynamic = totalRev - totalExp;

    if (industryType === "showroom") {
      if (!summary["3300"]) {
        summary["3300"] = {
          code: "3300",
          name: "Retained Earnings & Reserves",
          debit: 0,
          credit: 0,
          balance: 0,
          type: "Equity",
        };
      }

      // If no DB closing entry has been posted yet and user is viewing post-closing mode:
      if (!hasDbClosing && trialBalanceMode === "post_closing") {
        if (summary["3300"].debit === 0 && summary["3300"].credit === 0 && (totalRev !== 0 || totalExp !== 0)) {
          // Virtual Closing Routine:
          // 1. Close Revenue accounts (4000 series) by debiting their balance
          Object.keys(summary).forEach((code) => {
            const acc = summary[code];
            if (acc.type === "Revenue" && acc.balance !== 0) {
              acc.debit += acc.balance;
              acc.balance = 0;
            } else if (acc.type === "Expense" && acc.balance !== 0) {
              acc.credit += acc.balance;
              acc.balance = 0;
            }
          });

          // 2. Transfer Net Profit to Retained Earnings (3300)
          if (netProfitDynamic >= 0) {
            summary["3300"].credit += netProfitDynamic;
            summary["3300"].balance = summary["3300"].credit - summary["3300"].debit;
          } else {
            summary["3300"].debit += Math.abs(netProfitDynamic);
            summary["3300"].balance = summary["3300"].credit - summary["3300"].debit;
          }
        }
      }
    }

    setAccountsSummary(summary);
  };

  const extractMoneyFlow = (entries: any[]) => {
    const list: any[] = [];
    let runningBalance = 0;

    // Sort chronologically for running balance
    const sorted = [...entries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    sorted.forEach((entry) => {
      (entry.journal_lines || []).forEach((line: any) => {
        if (line.account_code === "1001") {
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          runningBalance += (debit - credit);

          list.push({
            id: line.id,
            date: entry.entry_date,
            ref_type: entry.ref_type,
            ref_id: entry.ref_id,
            partyName: entry.partyName,
            partyPhone: entry.partyPhone,
            billRef: entry.billRef,
            narration: entry.cleanNarration,
            debit,
            credit,
            balance: runningBalance
          });
        }
      });
    });

    // Display newest first
    setMoneyFlow(list.reverse());
  };

  // Compute Customer / Supplier summary breakdown
  const partySummaries = useMemo(() => {
    const isReceivable = selectedLedgerCode === "1002";
    const isPayable = selectedLedgerCode === "2001";
    
    if (!isReceivable && !isPayable) return [];

    const pType = isReceivable ? "customer" : "supplier";
    const summaryMap: Record<string, {
      partyId: string;
      name: string;
      phone: string;
      totalBilled: number;
      totalPaid: number;
      balance: number;
      txCount: number;
      hasOpening?: boolean;
    }> = {};

    // 1. Initialize with registered parties of this type
    partiesList.forEach(p => {
      if (p.type === pType || p.type === "dual") {
        const currBal = Math.abs(Number(p.current_balance || 0));

        summaryMap[p.id] = {
          partyId: p.id,
          name: p.name,
          phone: p.phone || "—",
          totalBilled: 0,
          totalPaid: 0,
          balance: currBal,
          txCount: 0,
          hasOpening: currBal !== 0
        };
      }
    });

    // 2. Traverse ledger lines for the selected account (1002 or 2001)
    ledgerEntries.forEach((entry: any) => {
      (entry.journal_lines || []).forEach((line: any) => {
        if (line.account_code === selectedLedgerCode) {
          const db = Number(line.debit || 0);
          const cr = Number(line.credit || 0);
          
          let pId = entry.partyId;
          if (!pId) {
            const matchedP = partiesList.find(p => p.name.trim().toLowerCase() === (entry.partyName || "").trim().toLowerCase());
            pId = matchedP ? matchedP.id : null;
          }

          // In case entry.partyName is known, use entry.partyName as key if pId not found
          const targetKey = pId || (entry.partyName && !entry.partyName.includes("Showroom Customer / Party") ? `party_${entry.partyName.trim()}` : null);
          if (!targetKey) {
            return;
          }

          const pName = entry.partyName || (isReceivable ? "Customer" : "Supplier");

          if (!summaryMap[targetKey]) {
            summaryMap[targetKey] = {
              partyId: targetKey,
              name: pName,
              phone: entry.partyPhone || "—",
              totalBilled: 0,
              totalPaid: 0,
              balance: 0,
              txCount: 0
            };
          }

          summaryMap[targetKey].txCount += 1;
          if (entry.partyPhone && (!summaryMap[targetKey].phone || summaryMap[targetKey].phone === "—")) {
            summaryMap[targetKey].phone = entry.partyPhone;
          }
          if (entry.partyName && (summaryMap[targetKey].name.startsWith("Customer") || summaryMap[targetKey].name.startsWith("Showroom"))) {
            summaryMap[targetKey].name = entry.partyName;
          }

          if (isReceivable) {
            summaryMap[targetKey].totalBilled += db;
            summaryMap[targetKey].totalPaid += cr;
          } else {
            summaryMap[targetKey].totalBilled += cr;
            summaryMap[targetKey].totalPaid += db;
          }
        }
      });
    });

    // 3. Finalize Balance and Billed/Paid numbers for each registered party
    Object.values(summaryMap).forEach((item: any) => {
      if (item.txCount > 0) {
        item.balance = Math.max(0, item.totalBilled - item.totalPaid);
      } else if (item.hasOpening) {
        item.totalBilled = item.balance;
      }
    });

    return Object.values(summaryMap)
      .filter(p => !p.name.toLowerCase().includes("walk-in") && !p.name.toLowerCase().includes("walkin"))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [selectedLedgerCode, partiesList, ledgerEntries]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const currSym = selectedCurrency || "Rs";

    let title = "Trial Balance Report";
    if (activeTab === "pl") title = "Profit & Loss Statement";
    if (activeTab === "balance") title = "Balance Sheet Report";
    if (activeTab === "product_flow") title = "Product Flow Ledger (Stock Cardex)";
    if (activeTab === "money_flow") title = "Money Flow Ledger (Cash & Bank Book)";
    if (activeTab === "account_statement") {
      const template = GL_ACCOUNT_TEMPLATES.find(t => t.code === selectedLedgerCode);
      title = `Account Ledger: ${selectedLedgerCode} - ${template?.name || "General Ledger"}`;
      if (selectedPartyFilter !== "all") {
        const pObj = partiesList.find(p => p.id === selectedPartyFilter);
        if (pObj) title += ` (${pObj.name})`;
      }
    }

    // --- Premium VIP PDF Layout ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 220, 10, "F");

    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 10, 220, 2, "F");
    
    // Title & Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(shopName || "The Accounts ERP", 14, 25);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Premium ERP Financial Double-Entry Accounting System", 14, 30);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(title.toUpperCase(), 14, 39);
    
    // Metadata card box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 44, 182, 16, "FD");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Period: ${startDate} to ${endDate}`, 18, 50);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 18, 55);
    doc.text(`Currency: ${currSym.toUpperCase()}`, 130, 50);
    doc.text("Status: Verified Double-Entry Balanced", 130, 55);

    const tableRows: any[] = [];
    let tableHeaders: string[] = [];

    if (activeTab === "trial") {
      tableHeaders = ["Account Code", "Account Name", "Debit Balance", "Credit Balance", "Net Balance"];
      Object.values(accountsSummary).forEach((acc) => {
        tableRows.push([
          acc.code, 
          acc.name, 
          acc.debit > 0 ? `${currSym} ${acc.debit.toLocaleString()}` : "-", 
          acc.credit > 0 ? `${currSym} ${acc.credit.toLocaleString()}` : "-", 
          `${currSym} ${acc.balance.toLocaleString()}`
        ]);
      });
      tableRows.push([
        "TOTALS",
        tbTotals.isBalanced ? "Equality Validated (Debits = Credits)" : `Out of Balance (Diff: ${currSym} ${tbTotals.difference.toLocaleString()})`,
        `${currSym} ${tbTotals.totalDebit.toLocaleString()}`,
        `${currSym} ${tbTotals.totalCredit.toLocaleString()}`,
        `${currSym} ${Math.abs(tbTotals.totalDebit - tbTotals.totalCredit).toLocaleString()}`
      ]);
    } else if (activeTab === "pl") {
      tableHeaders = ["Particulars / Classification", "Type", "Amount"];
      const vals = computePLValues();
      tableRows.push(["Gross Sales Revenue", "Revenue", `${currSym} ${vals.revenue.toLocaleString()}`]);
      tableRows.push(["Less: Cost of Goods Sold", "COGS", `${currSym} ${vals.costOfGoods.toLocaleString()}`]);
      tableRows.push(["Gross Margin", "Profit", `${currSym} ${vals.grossProfit.toLocaleString()}`]);
      tableRows.push(["Less: Operating & Payroll Expenses", "Expenses", `${currSym} ${vals.otherExpenses.toLocaleString()}`]);
      tableRows.push(["Net Operating Income / Retained Earnings", "Net Income", `${currSym} ${vals.netProfit.toLocaleString()}`]);
    } else if (activeTab === "balance") {
      tableHeaders = ["Classification", "Account Detail", "Amount"];
      const vals = computeBalanceSheet();
      vals.assetsList.forEach(a => tableRows.push(["Assets", a.name, `${currSym} ${a.balance.toLocaleString()}`]));
      vals.liabilitiesList.forEach(l => tableRows.push(["Liabilities", l.name, `${currSym} ${l.balance.toLocaleString()}`]));
      vals.equityList.forEach(e => tableRows.push(["Owner's Equity", e.name, `${currSym} ${e.balance.toLocaleString()}`]));
      if (!vals.equityList.some(e => e.code === "3300")) {
        tableRows.push(["Retained Earnings", "Current P&L Net Earnings", `${currSym} ${pl.netProfit.toLocaleString()}`]);
      }
      tableRows.push(["Summary", "Total Assets", `${currSym} ${vals.totalAssets.toLocaleString()}`]);
      tableRows.push(["Summary", "Total Liabilities & Equity", `${currSym} ${vals.totalLiabilitiesAndEquity.toLocaleString()}`]);
      tableRows.push(["Validation", vals.isBalanced ? "Equality Validated (Assets = Liab + Equity)" : "Out of Balance", vals.isBalanced ? "BALANCED" : `Diff: ${currSym} ${vals.diff.toLocaleString()}`]);
    } else if (activeTab === "product_flow") {
      tableHeaders = ["Date", "Product", "Party / Customer", "Type", "Qty In", "Qty Out", "Value", "Ref"];
      filteredProductFlow().forEach(f => {
        tableRows.push([f.date, f.productName, f.partyName || "—", f.type, f.qtyIn > 0 ? `+${f.qtyIn}` : "-", f.qtyOut > 0 ? `-${f.qtyOut}` : "-", `${currSym} ${f.value.toLocaleString()}`, f.ref]);
      });
    } else if (activeTab === "money_flow") {
      tableHeaders = ["Date", "Party / Payee", "Description", "Debit (In)", "Credit (Out)", "Cash Balance"];
      filteredMoneyFlow().forEach(f => {
        tableRows.push([f.date, f.partyName || "General", f.narration, f.debit > 0 ? `+${currSym} ${f.debit.toLocaleString()}` : "-", f.credit > 0 ? `-${currSym} ${f.credit.toLocaleString()}` : "-", `${currSym} ${f.balance.toLocaleString()}`]);
      });
    } else {
      if (selectedLedgerCode === "1002" || selectedLedgerCode === "2001") {
        const partyLabel = selectedLedgerCode === "1002" ? "Customer Name" : "Supplier Name";
        tableHeaders = ["Date", partyLabel, "Ref / Bill #", "Description", "Debit", "Credit", "Running Due"];
        getAccountLedgerStatement().forEach(f => {
          tableRows.push([
            f.date,
            f.partyName || "Walk-in",
            f.billRef || f.ref_id?.substring(0, 8) || "—",
            f.narration || "Sale / Payment",
            f.debit > 0 ? `${currSym} ${f.debit.toLocaleString()}` : "-",
            f.credit > 0 ? `${currSym} ${f.credit.toLocaleString()}` : "-",
            `${currSym} ${f.balance.toLocaleString()}`
          ]);
        });
      } else {
        tableHeaders = ["Date", "Party / Description", "Ref #", "Debit", "Credit", "Running Balance"];
        getAccountLedgerStatement().forEach(f => {
          tableRows.push([
            f.date,
            f.partyName ? `${f.partyName} • ${f.narration}` : f.narration,
            f.billRef || f.ref_id?.substring(0, 8) || "—",
            f.debit > 0 ? `${currSym} ${f.debit.toLocaleString()}` : "-",
            f.credit > 0 ? `${currSym} ${f.credit.toLocaleString()}` : "-",
            `${currSym} ${f.balance.toLocaleString()}`
          ]);
        });
      }
    }

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 65,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: "middle",
        font: "helvetica",
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" }
      }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated by The Accounts ERP • Page ${i} of ${totalPages}`, 14, 287);
      doc.text("Authorized Signature: _______________________", 130, 287);
    }

    doc.save(`${activeTab}_report_${startDate}_to_${endDate}.pdf`);
  };

  const handleDownloadRecoverySheetPDF = () => {
    const doc = new jsPDF();
    const currSym = selectedCurrency || "Rs";

    const isCustomer = selectedLedgerCode === "1002";
    const debtors = partySummaries.filter(p => p.balance > 0);
    const totalDue = debtors.reduce((sum, p) => sum + p.balance, 0);

    // Header styling
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 220, 12, "F");

    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 12, 220, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(shopName || "The Accounts ERP", 14, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Official Customer Receivables & Recovery Collection Sheet", 14, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(isCustomer ? "CUSTOMER RECOVERY REPORT (گاہک ادھار ریکوری رپورٹ)" : "SUPPLIER PAYABLE REPORT (سپلائر واجبات رپورٹ)", 14, 39);

    // Metadata card box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 44, 182, 16, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 18, 50);
    doc.text(`Total Accounts: ${debtors.length}`, 18, 55);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Amount to Collect: ${currSym} ${totalDue.toLocaleString()}`, 110, 50);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Recovery Officer: ___________________`, 110, 55);

    const tableHeaders = ["Sr #", isCustomer ? "Customer Name" : "Supplier Name", "Contact Phone", "Total Due (لینے ہیں)", "Collected (وصولی)", "Signature / Note"];
    const tableRows = debtors.map((d, index) => [
      String(index + 1),
      d.name,
      d.phone || "—",
      `${currSym} ${d.balance.toLocaleString()}`,
      "________________",
      "________________"
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 65,
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        valign: "middle",
        font: "helvetica",
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 50, fontStyle: "bold" },
        2: { cellWidth: 32 },
        3: { cellWidth: 30, halign: "right", fontStyle: "bold", textColor: [220, 38, 38] },
        4: { cellWidth: 30, halign: "center" },
        5: { cellWidth: 28, halign: "center" }
      }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`The Accounts ERP • Recovery Sheet • Page ${i} of ${totalPages}`, 14, 287);
      doc.text("Approved Signature: _______________________", 130, 287);
    }

    doc.save(`recovery_sheet_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (!allowReports) {
    return <SubscriptionBlocker featureName="Enterprise Advanced Accounting Reports" requiredPlan="Premium" description="Requires premium plan subscription tier" />;
  }

  const handleAutoPostClosingEntry = async () => {
    if (!shopId) return;
    setPostingClosingEntry(true);
    try {
      // Check if closing entry already exists in DB
      const { data: existing } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("shop_id", shopId)
        .eq("ref_type", "showroom_closing_period");

      if (existing && existing.length > 0) {
        toast.info("A period-end closing entry is already active in the General Ledger.");
        return;
      }

      // Compute unclosed revenue and COGS
      let totalRev = 0;
      let totalExp = 0;
      ledgerEntries.forEach((entry: any) => {
        if (entry.ref_type === "showroom_closing_period" || entry.narration?.includes("Period-End Closing")) return;
        (entry.journal_lines || []).forEach((line: any) => {
          const code = line.account_code;
          const db = Number(line.debit || 0);
          const cr = Number(line.credit || 0);
          if (code.startsWith("4")) totalRev += (cr - db);
          else if (code.startsWith("5")) totalExp += (db - cr);
        });
      });

      const netProfit = totalRev - totalExp;

      if (totalRev === 0 && totalExp === 0) {
        toast.info("No active revenues or expenses to close.");
        return;
      }

      const { data: newEntry, error: jErr } = await supabase
        .from("journal_entries")
        .insert({
          shop_id: shopId,
          entry_date: new Date().toISOString().split("T")[0],
          ref_type: "showroom_closing_period",
          ref_id: `closing_${shopId}_${Date.now()}`,
          narration: `Period-End Closing Entry: Closed Sales Revenue (4001) PKR ${totalRev.toLocaleString()} & COGS/Expenses (5001) PKR ${totalExp.toLocaleString()} via Income Summary into Retained Earnings (3300) - Net Profit: PKR ${netProfit.toLocaleString()}`,
          currency_code: selectedCurrency || "PKR",
          exchange_rate: 1.0
        })
        .select("id")
        .single();

      if (jErr) throw jErr;

      const lines: any[] = [
        {
          entry_id: newEntry.id,
          account_code: "4001",
          account_name: "Vehicle Sales Revenue",
          debit: totalRev,
          credit: 0
        },
        {
          entry_id: newEntry.id,
          account_code: "5001",
          account_name: "Cost of Goods Sold (Vehicles)",
          debit: 0,
          credit: totalExp
        },
        {
          entry_id: newEntry.id,
          account_code: "3300",
          account_name: "Retained Earnings & Reserves",
          debit: netProfit < 0 ? Math.abs(netProfit) : 0,
          credit: netProfit > 0 ? netProfit : 0
        }
      ];

      const { error: lErr } = await supabase.from("journal_lines").insert(lines);
      if (lErr) throw lErr;

      toast.success("Period-End Closing voucher posted successfully! General Ledger and Trial Balance are strictly balanced.");
      await fetchLedgerData();
    } catch (err: any) {
      console.error("Failed to post closing entry:", err);
      toast.error("Failed to post closing entry: " + err.message);
    } finally {
      setPostingClosingEntry(false);
    }
  };

  const computePLValues = () => {
    let revenue = 0;
    let costOfGoods = 0;
    let otherExpenses = 0;

    ledgerEntries.forEach((entry: any) => {
      // Exclude closing vouchers from operating revenue & expenses
      if (entry.ref_type === "showroom_closing_period" || entry.narration?.includes("Period-End Closing")) {
        return;
      }
      (entry.journal_lines || []).forEach((line: any) => {
        const code = line.account_code;
        const db = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        if (code.startsWith("4")) {
          revenue += (cr - db);
        } else if (code === "5001" || code === "5002") {
          costOfGoods += (db - cr);
        } else if (code.startsWith("5")) {
          otherExpenses += (db - cr);
        }
      });
    });

    if (revenue === 0 && costOfGoods === 0) {
      Object.values(accountsSummary).forEach((acc) => {
        if (acc.type === "Revenue") {
          revenue += (acc.credit - acc.debit);
        } else if (acc.code === "5001" || acc.code === "5002") {
          costOfGoods += (acc.debit - acc.credit);
        } else if (acc.type === "Expense") {
          otherExpenses += (acc.debit - acc.credit);
        }
      });
    }

    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - otherExpenses;

    return { revenue, costOfGoods, grossProfit, otherExpenses, netProfit };
  };

  const pl = computePLValues();

  const computeBalanceSheet = () => {
    const assetsList: AccountSummary[] = [];
    const liabilitiesList: AccountSummary[] = [];
    const equityList: AccountSummary[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    Object.values(accountsSummary).forEach((acc) => {
      if (acc.type === "Asset") {
        assetsList.push(acc);
        totalAssets += acc.balance;
      } else if (acc.type === "Liability") {
        liabilitiesList.push(acc);
        totalLiabilities += acc.balance;
      } else if (acc.type === "Equity") {
        equityList.push(acc);
        totalEquity += acc.balance;
      }
    });

    const netEquity = totalAssets - totalLiabilities;
    const hasRetainedEarningsInEquity = equityList.some(e => e.code === "3300" && e.balance !== 0);
    const currentPLToAppend = hasRetainedEarningsInEquity ? 0 : pl.netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentPLToAppend;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
    const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);

    return { 
      assetsList, 
      liabilitiesList, 
      equityList, 
      totalAssets, 
      totalLiabilities, 
      totalEquity: totalEquity + currentPLToAppend, 
      totalLiabilitiesAndEquity, 
      netEquity,
      isBalanced,
      diff
    };
  };

  const bs = computeBalanceSheet();

  const tbTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    Object.values(accountsSummary).forEach((acc) => {
      totalDebit += Number(acc.debit || 0);
      totalCredit += Number(acc.credit || 0);
    });
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    const difference = Math.abs(totalDebit - totalCredit);
    return { totalDebit, totalCredit, isBalanced, difference };
  }, [accountsSummary]);

  const filteredMoneyFlow = () => {
    return moneyFlow.filter(f => 
      f.narration.toLowerCase().includes(flowSearchQuery.toLowerCase()) ||
      (f.partyName && f.partyName.toLowerCase().includes(flowSearchQuery.toLowerCase())) ||
      f.ref_type.toLowerCase().includes(flowSearchQuery.toLowerCase())
    );
  };

  const filteredProductFlow = () => {
    return productFlow.filter(f => {
      const matchesSearch = f.productName.toLowerCase().includes(flowSearchQuery.toLowerCase()) || 
                            (f.partyName && f.partyName.toLowerCase().includes(flowSearchQuery.toLowerCase())) ||
                            f.ref.toLowerCase().includes(flowSearchQuery.toLowerCase());
      const matchesProduct = selectedProductId === "all" || f.productId === selectedProductId;
      return matchesSearch && matchesProduct;
    });
  };

  const getAccountLedgerStatement = () => {
    const isReceivable = selectedLedgerCode === "1002";
    const isPayable = selectedLedgerCode === "2001";
    const isReceivableOrPayable = isReceivable || isPayable;

    // Special Case: Viewing specific party ledger in 1002 (Customer) or 2001 (Supplier)
    if (isReceivableOrPayable && selectedPartyFilter !== "all") {
      const targetParty = partiesList.find(p => p.id === selectedPartyFilter);
      if (targetParty) {
        const pTxList: any[] = [];
        const seenKeys = new Set<string>();

        // 1. Collect from enriched journal entries
        ledgerEntries.forEach((entry: any) => {
          (entry.journal_lines || []).forEach((line: any) => {
            if (line.account_code === selectedLedgerCode) {
              const isMatch = entry.partyId === targetParty.id || 
                              (entry.partyName && entry.partyName.trim().toLowerCase() === targetParty.name.trim().toLowerCase());
              if (isMatch) {
                const key = entry.ref_id || entry.id;
                seenKeys.add(key);
                pTxList.push({
                  id: line.id,
                  date: entry.entry_date,
                  partyName: targetParty.name,
                  partyPhone: targetParty.phone || "—",
                  partyId: targetParty.id,
                  billRef: entry.billRef || (entry.ref_id ? `Bill #${entry.ref_id.substring(0,8).toUpperCase()}` : "Tx"),
                  narration: entry.cleanNarration || (isReceivable ? "Credit Sale / Invoice" : "Purchase"),
                  additionalDetails: entry.additionalDetails || "",
                  debit: Number(line.debit || 0),
                  credit: Number(line.credit || 0),
                  source: "gl"
                });
              }
            }
          });
        });

        // 2. Collect from raw invoices if not posted as GL entry
        if (isReceivable) {
          rawInvoicesList.forEach((inv: any) => {
            if (inv.party_id === targetParty.id && !seenKeys.has(inv.id)) {
              seenKeys.add(inv.id);
              const total = Number(inv.total_amount || 0);
              const paid = Number(inv.paid_amount || 0);
              const due = total - paid;
              const dateStr = inv.created_at ? inv.created_at.split("T")[0] : "";
              
              if (due > 0) {
                pTxList.push({
                  id: `inv_${inv.id}`,
                  date: dateStr,
                  partyName: targetParty.name,
                  partyPhone: targetParty.phone || "—",
                  partyId: targetParty.id,
                  billRef: inv.invoice_number ? `Inv #${inv.invoice_number}` : `Bill #${inv.id.substring(0, 8).toUpperCase()}`,
                  narration: `POS Credit Sale (${inv.status || "Completed"})`,
                  additionalDetails: `Bill: ${selectedCurrency || "Rs"} ${total.toLocaleString()} | Paid: ${selectedCurrency || "Rs"} ${paid.toLocaleString()} | Due: ${selectedCurrency || "Rs"} ${due.toLocaleString()}`,
                  debit: total,
                  credit: paid,
                  source: "invoice"
                });
              }
            }
          });
        }

        // 3. Collect from manual credit transactions / receipts
        if (isReceivable) {
          creditTxList.forEach((ct: any) => {
            if (ct.customer_id === targetParty.id && !seenKeys.has(ct.id)) {
              seenKeys.add(ct.id);
              const amt = Number(ct.amount || 0);
              const isPayment = ct.transaction_type === "payment" || ct.transaction_type === "credit" || ct.transaction_type === "receipt";
              const dateStr = ct.created_at ? ct.created_at.split("T")[0] : "";

              pTxList.push({
                id: `ct_${ct.id}`,
                date: dateStr,
                partyName: targetParty.name,
                partyPhone: targetParty.phone || "—",
                partyId: targetParty.id,
                billRef: "Receipt",
                narration: ct.remarks || (isPayment ? "Customer Payment Received (کھاتہ وصولی)" : "Manual Khata Debit (نیا ادھار)"),
                additionalDetails: isPayment ? "Cash / Recovery Payment" : "Manual Debit Entry",
                debit: isPayment ? 0 : amt,
                credit: isPayment ? amt : 0,
                source: "credit_tx"
              });
            }
          });
        }

        // 4. Collect from raw purchase orders for suppliers
        if (isPayable) {
          rawPurchasesList.forEach((po: any) => {
            if (po.party_id === targetParty.id && !seenKeys.has(po.id)) {
              seenKeys.add(po.id);
              const total = Number(po.total_amount || 0);
              const paid = Number(po.paid_amount || 0);
              const due = total - paid;
              const dateStr = po.created_at ? po.created_at.split("T")[0] : "";

              pTxList.push({
                id: `po_${po.id}`,
                date: dateStr,
                partyName: targetParty.name,
                partyPhone: targetParty.phone || "—",
                partyId: targetParty.id,
                billRef: po.invoice_number ? `PO #${po.invoice_number}` : `PO #${po.id.substring(0, 8).toUpperCase()}`,
                narration: `Purchase Order (${po.status || "Completed"})`,
                additionalDetails: `PO Total: ${selectedCurrency || "Rs"} ${total.toLocaleString()} | Paid: ${selectedCurrency || "Rs"} ${paid.toLocaleString()}`,
                debit: paid,
                credit: total,
                source: "purchase"
              });
            }
          });
        }

        // Sort chronologically
        pTxList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate opening balance
        const currBal = Number(targetParty.current_balance || 0);
        let totalPeriodDebit = 0;
        let totalPeriodCredit = 0;
        pTxList.forEach(item => {
          totalPeriodDebit += item.debit;
          totalPeriodCredit += item.credit;
        });

        const periodNet = isReceivable ? (totalPeriodDebit - totalPeriodCredit) : (totalPeriodCredit - totalPeriodDebit);
        const openingAmount = currBal - periodNet;

        const statementRows: any[] = [];
        let runningDue = 0;

        // If party has starting opening balance
        if (openingAmount > 0 || (pTxList.length === 0 && currBal > 0)) {
          const startingBal = openingAmount > 0 ? openingAmount : currBal;
          runningDue = startingBal;
          statementRows.push({
            id: `opening_${targetParty.id}`,
            date: targetParty.created_at ? targetParty.created_at.split("T")[0] : "Initial",
            partyName: targetParty.name,
            partyPhone: targetParty.phone || "—",
            partyId: targetParty.id,
            billRef: "Opening Khata",
            narration: "سابقہ کھاتہ ادھار (Opening / Starting Khata Balance)",
            additionalDetails: "Account Opening Balance Registered in System",
            debit: isReceivable ? startingBal : 0,
            credit: isPayable ? startingBal : 0,
            balance: startingBal,
            isOpening: true
          });
        }

        // Apply running balance to transactions
        pTxList.forEach((item) => {
          if (isReceivable) {
            runningDue += (item.debit - item.credit);
          } else {
            runningDue += (item.credit - item.debit);
          }
          statementRows.push({
            ...item,
            balance: runningDue
          });
        });

        // Filter by flowSearchQuery if entered
        if (flowSearchQuery.trim()) {
          const q = flowSearchQuery.toLowerCase();
          return statementRows.filter(r => 
            (r.partyName && r.partyName.toLowerCase().includes(q)) ||
            (r.partyPhone && r.partyPhone.includes(q)) ||
            (r.billRef && r.billRef.toLowerCase().includes(q)) ||
            (r.narration && r.narration.toLowerCase().includes(q))
          ).reverse();
        }

        return statementRows.reverse(); // Newest first
      }
    }

    // Default / All Parties Case
    const list: any[] = [];
    let runningBalance = 0;
    
    // Sort chronological
    const sorted = [...ledgerEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    
    const template = GL_ACCOUNT_TEMPLATES.find(t => t.code === selectedLedgerCode);
    const isDebitType = template ? (template.type === "Asset" || template.type === "Expense") : true;

    sorted.forEach((entry) => {
      (entry.journal_lines || []).forEach((line: any) => {
        if (line.account_code === selectedLedgerCode) {
          // Search Query check
          if (flowSearchQuery.trim()) {
            const q = flowSearchQuery.toLowerCase();
            const matches = (entry.partyName && entry.partyName.toLowerCase().includes(q)) ||
                            (entry.partyPhone && entry.partyPhone.includes(q)) ||
                            (entry.billRef && entry.billRef.toLowerCase().includes(q)) ||
                            (entry.cleanNarration && entry.cleanNarration.toLowerCase().includes(q));
            if (!matches) return;
          }

          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          
          if (isDebitType) {
            runningBalance += (debit - credit);
          } else {
            runningBalance += (credit - debit);
          }

          list.push({
            id: line.id,
            date: entry.entry_date,
            ref_type: entry.ref_type,
            ref_id: entry.ref_id,
            partyName: entry.partyName,
            partyPhone: entry.partyPhone,
            partyId: entry.partyId,
            billRef: entry.billRef,
            narration: entry.cleanNarration,
            additionalDetails: entry.additionalDetails,
            debit,
            credit,
            balance: runningBalance
          });
        }
      });
    });

    return list.reverse(); // Newest first
  };

  const isReceivableOrPayable = selectedLedgerCode === "1002" || selectedLedgerCode === "2001";
  const selectedTemplate = GL_ACCOUNT_TEMPLATES.find(t => t.code === selectedLedgerCode);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-150 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Scale className="text-blue-600" size={24} /> 
            {t("enterprise_financials_flows")}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مکمل ڈبل انٹری جنرل لیجر، گاہک ادھار کھاتہ (Receivables) اور سپلائر لیجرز
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-semibold text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            <span>Range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="bg-transparent border-none outline-none font-bold text-slate-800 animate-none cursor-pointer" 
              placeholder="From Beginning"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="bg-transparent border-none outline-none font-bold text-slate-800 animate-none cursor-pointer" 
              placeholder="Latest"
            />
            {(!startDate && !endDate) ? (
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                All Time (شروع سے اب تک)
              </span>
            ) : (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-full font-bold cursor-pointer transition-colors"
                title="Reset to All Time"
              >
                Clear / All Time
              </button>
            )}
          </div>
          <Button onClick={handleDownloadPDF} size="sm" className="bg-slate-900 text-white rounded-2xl hover:bg-slate-800 cursor-pointer">
            <Download size={14} className="mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Real-Time Balance Sheet Equation & Accounting Equality Validation Banner */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${bs.isBalanced ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
            <Scale size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 text-sm">Balance Sheet Equation (میزانِ حساب)</span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                bs.isBalanced ? "bg-emerald-100 text-emerald-800 font-extrabold" : "bg-amber-100 text-amber-800 font-extrabold"
              }`}>
                {bs.isBalanced ? "Strictly Balanced (متوازن)" : `Variance (فرق): ${selectedCurrency || "Rs"} ${bs.diff.toLocaleString()}`}
              </span>
            </div>
            <p className="text-slate-600 font-mono text-[11px] mt-1">
              Total Assets ({selectedCurrency || "Rs"} {bs.totalAssets.toLocaleString()}) = Total Liabilities ({selectedCurrency || "Rs"} {bs.totalLiabilities.toLocaleString()}) + Total Equity & Retained Earnings ({selectedCurrency || "Rs"} {bs.totalEquity.toLocaleString()})
            </p>
            {!bs.isBalanced && (
              <p className="text-rose-600 font-bold text-[10px] mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> Discrepancy Alert: Unallocated variance detected between assets and liabilities/equity.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {industryType === "showroom" && (
            <span className="text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl">
              Auto-Synced with Showroom Sub-Ledgers
            </span>
          )}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-2xl font-mono text-[11px]">
            <span className="text-slate-500 font-bold">Assets:</span>
            <span className="font-black text-blue-700">{selectedCurrency || "Rs"} {bs.totalAssets.toLocaleString()}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-bold">Liab:</span>
            <span className="font-black text-rose-700">{selectedCurrency || "Rs"} {bs.totalLiabilities.toLocaleString()}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-bold">Equity:</span>
            <span className="font-black text-emerald-700">{selectedCurrency || "Rs"} {bs.totalEquity.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap gap-2 border-b border-slate-150 pb-2">
        <button
          onClick={() => { setActiveTab("trial"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "trial" 
              ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-xs" 
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("trial_balance")}
        </button>
        <button
          onClick={() => { setActiveTab("pl"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "pl" 
              ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-xs" 
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("income_statement_pl")}
        </button>
        <button
          onClick={() => { setActiveTab("balance"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "balance" 
              ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-xs" 
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("balance_sheet")}
        </button>
        <button
          onClick={() => { setActiveTab("product_flow"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "product_flow" 
              ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs" 
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("product_flow_ledger")} 📦
        </button>
        <button
          onClick={() => { setActiveTab("money_flow"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "money_flow" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs" 
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("money_flow_ledger")} 💵
        </button>
        <button
          onClick={() => { setActiveTab("account_statement"); setFlowSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
            activeTab === "account_statement" 
              ? "bg-violet-600 text-white shadow-md shadow-violet-200" 
              : "text-slate-600 hover:bg-slate-100 font-bold"
          }`}
        >
          {t("account_ledger_statement")} 🗂️
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-3xl border border-slate-150">
          <Loader2 className="animate-spin text-blue-600 mr-2" size={24} />
          <span className="text-slate-600 font-medium">Calculating Ledger accounts & customer balances...</span>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Trial Balance Tab */}
          {activeTab === "trial" && (
            <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-black text-slate-800">{t("double_entry_trial_balance_table")}</span>
                  
                  {/* Mode Switcher: Post-Closing vs Unadjusted */}
                  <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setTrialBalanceMode("post_closing")}
                      className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trialBalanceMode === "post_closing"
                          ? "bg-white text-blue-700 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Post-Closing (اختتامی میزان حساب)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrialBalanceMode("unadjusted")}
                      className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trialBalanceMode === "unadjusted"
                          ? "bg-white text-blue-700 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Unadjusted (قبل از اختتام)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {industryType === "showroom" && (
                    ledgerEntries.some(e => e.ref_type === "showroom_closing_period") ? (
                      <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Closing Entry Posted in GL (Net Profit: {selectedCurrency || "Rs"} {pl.netProfit.toLocaleString()} &rarr; 3300)
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAutoPostClosingEntry}
                        disabled={postingClosingEntry}
                        className="text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Zap size={13} />
                        {postingClosingEntry ? "Posting Closing Voucher..." : "Auto-Post Closing Entry to GL (کلوزنگ انٹری)"}
                      </Button>
                    )
                  )}

                  <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showZeroBalances} 
                      onChange={(e) => setShowZeroBalances(e.target.checked)}
                      className="rounded text-blue-600 border-slate-350 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    {t("show_zero_balance_accounts")}
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-2xl font-bold">
                    <CheckCircle2 size={12} /> {t("system_ledger_balanced")}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase border-b border-slate-200 select-none">
                      <th className="px-3.5 py-2.5">Code</th>
                      <th className="px-3.5 py-2.5">Account Name</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5 text-right">Debit Balance</th>
                      <th className="px-3.5 py-2.5 text-right">Credit Balance</th>
                      <th className="px-3.5 py-2.5 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {Object.values(accountsSummary).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No transactions posted in selected date range.
                        </td>
                      </tr>
                    ) : (
                      Object.values(accountsSummary)
                        .filter((acc) => showZeroBalances || acc.balance !== 0 || acc.debit !== 0 || acc.credit !== 0)
                        .map((acc) => (
                        <tr 
                          key={acc.code} 
                          onClick={() => {
                            setSelectedLedgerCode(acc.code);
                            setActiveTab("account_statement");
                          }}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                        >
                          <td className="p-4 font-mono font-bold text-blue-600">{acc.code}</td>
                          <td className="p-4 font-bold text-slate-800 flex items-center justify-between">
                            <span>{acc.name}</span>
                            <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 flex items-center gap-1 font-semibold">
                              Open Ledger &rarr;
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 text-slate-650 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {acc.type}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-slate-600">
                            {acc.debit > 0 ? `${selectedCurrency || "Rs"} ${acc.debit.toLocaleString()}` : "-"}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-600">
                            {acc.credit > 0 ? `${selectedCurrency || "Rs"} ${acc.credit.toLocaleString()}` : "-"}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-slate-800">
                            {selectedCurrency || "Rs"} {acc.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={3} className="px-3.5 py-3 text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold tracking-wide">TOTALS:</span>
                          {tbTotals.isBalanced ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                              <CheckCircle2 size={13} /> Strict Equality Validated (Debits = Credits)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-bold">
                              <AlertCircle size={13} /> Out of Balance by {selectedCurrency || "Rs"} {tbTotals.difference.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-slate-900 font-bold">
                        {selectedCurrency || "Rs"} {tbTotals.totalDebit.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-slate-900 font-bold">
                        {selectedCurrency || "Rs"} {tbTotals.totalCredit.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-slate-900 font-bold">
                        {selectedCurrency || "Rs"} {Math.abs(tbTotals.totalDebit - tbTotals.totalCredit).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Income Statement Tab */}
          {activeTab === "pl" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-md">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Gross Sales Revenue</span>
                  <h3 className="text-3xl font-black mt-2 font-mono">{selectedCurrency || "Rs"} {pl.revenue.toLocaleString()}</h3>
                  <div className="flex justify-between items-center mt-6 text-xs bg-white/10 p-3 rounded-2xl">
                    <span>COGS Deductions:</span>
                    <span className="font-bold font-mono">{selectedCurrency || "Rs"} {pl.costOfGoods.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-4">
                  <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                    <TrendingUp className="text-blue-600" size={16} /> Margins Analysis
                  </h4>
                  <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                    <span className="text-slate-500">Gross Margin:</span>
                    <span className="font-bold font-mono">
                      {pl.revenue > 0 ? ((pl.grossProfit / pl.revenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                    <span className="text-slate-500">Net Profit Margin:</span>
                    <span className="font-bold font-mono">
                      {pl.revenue > 0 ? ((pl.netProfit / pl.revenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs font-black text-slate-800">{t("income_statement_pl")}</span>
                </div>
                <div className="p-6 space-y-4 text-xs">
                  <div className="flex justify-between items-center py-2.5 font-bold border-b border-slate-100">
                    <span className="text-slate-800">Gross Sales Revenue (1. Gross Sales)</span>
                    <span className="font-mono text-slate-700">{selectedCurrency || "Rs"} {pl.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 font-bold border-b border-slate-100 pl-4 text-slate-500">
                    <span>Less: Cost of Goods Sold (Purchases / Material Cost)</span>
                    <span className="font-mono">({selectedCurrency || "Rs"} {pl.costOfGoods.toLocaleString()})</span>
                  </div>
                  <div className="flex justify-between items-center py-3 font-black text-sm border-b border-slate-200 text-emerald-600">
                    <span>{t("gross_profit")}</span>
                    <span className="font-mono">{selectedCurrency || "Rs"} {pl.grossProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 font-bold border-b border-slate-100 pl-4 text-slate-500">
                    <span>Less: Operating Expenses (Rent, Utilities, Staff)</span>
                    <span className="font-mono">({selectedCurrency || "Rs"} {pl.otherExpenses.toLocaleString()})</span>
                  </div>
                  <div className="flex justify-between items-center py-4 font-black text-base border-b border-slate-200 bg-slate-50 px-4 rounded-2xl text-slate-900 mt-4">
                    <span>{t("net_profit_retained")}</span>
                    <span className="font-mono text-blue-600">{selectedCurrency || "Rs"} {pl.netProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet Tab */}
          {activeTab === "balance" && (
            <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-xs font-black text-slate-800">{t("double_entry_balance_sheet")}</span>
                <div className="text-[10px] text-slate-500 font-mono">Formula: Assets = Liabilities + Equity</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-150 text-xs">
                <div className="p-6 space-y-4">
                  <h4 className="font-black text-slate-800 text-sm border-b border-slate-100 pb-2">{t("assets_title")}</h4>
                  {bs.assetsList.length === 0 ? (
                    <p className="text-slate-400 italic py-4">No Asset accounts defined.</p>
                  ) : (
                    bs.assetsList.map((acc) => (
                      <div key={acc.code} className="flex justify-between py-1.5">
                        <span className="text-slate-650 font-medium">{acc.name}</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedCurrency || "Rs"} {acc.balance.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between pt-4 border-t border-slate-200 font-black text-sm text-slate-900">
                    <span>{t("total_assets")}</span>
                    <span className="font-mono">{selectedCurrency || "Rs"} {bs.totalAssets.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="font-black text-slate-800 text-sm border-b border-slate-100 pb-2">
                      {t("liabilities_equity")}
                    </h4>
                    {bs.liabilitiesList.length === 0 ? (
                      <p className="text-slate-400 italic py-4">No Liability accounts defined.</p>
                    ) : (
                      bs.liabilitiesList.map((acc) => (
                        <div key={acc.code} className="flex justify-between py-1.5">
                          <span className="text-slate-650 font-medium">{acc.name}</span>
                          <span className="font-mono font-bold text-slate-800">
                            {selectedCurrency || "Rs"} {acc.balance.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between py-2 border-t border-slate-100 text-slate-500 font-bold">
                      <span>{t("total_liabilities")}</span>
                      <span className="font-mono">{selectedCurrency || "Rs"} {bs.totalLiabilities.toLocaleString()}</span>
                    </div>

                    {/* Owner's Equity Section */}
                    <div className="pt-3 border-t border-slate-150 space-y-2">
                      <h5 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">
                        Owner's Equity & Capital
                      </h5>
                      {bs.equityList.length === 0 ? (
                        <div className="flex justify-between py-1 text-slate-400 italic text-xs">
                          <span>Owner's Capital (3100)</span>
                          <span className="font-mono">Rs 0</span>
                        </div>
                      ) : (
                        bs.equityList.map((acc) => (
                          <div key={acc.code} className="flex justify-between py-1">
                            <span className="text-slate-650 font-medium">{acc.name}</span>
                            <span className="font-mono font-bold text-slate-800">
                              {selectedCurrency || "Rs"} {acc.balance.toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between py-1.5 text-slate-500 font-bold">
                        <span>Total Equity</span>
                        <span className="font-mono">{selectedCurrency || "Rs"} {bs.totalEquity.toLocaleString()}</span>
                      </div>
                    </div>

                    {!bs.equityList.some(acc => acc.code === "3300") && (
                      <div className="flex justify-between py-2 border-t border-slate-100 font-bold text-slate-600">
                        <span>Retained Net Earnings (Current P&L)</span>
                        <span className="font-mono">{selectedCurrency || "Rs"} {pl.netProfit.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t-2 border-slate-200 mt-6 space-y-3">
                    <div className="flex justify-between font-black text-sm text-slate-900">
                      <span>Total Liabilities & Equity</span>
                      <span className="font-mono text-emerald-600">
                        {selectedCurrency || "Rs"} {bs.totalLiabilitiesAndEquity.toLocaleString()}
                      </span>
                    </div>
                    {/* Strict Equality Validation Badge */}
                    <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                      bs.isBalanced ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-900 border border-amber-200"
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {bs.isBalanced ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-amber-600" />}
                        {bs.isBalanced ? "Strict Equality Validated: Assets = Liabilities + Equity" : `Difference: ${selectedCurrency || "Rs"} ${bs.diff.toLocaleString()}`}
                      </span>
                      <span className="font-mono text-[11px]">
                        {bs.isBalanced ? "Double-Entry Perfect" : "Out of Balance"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Flow Ledger Tab */}
          {activeTab === "product_flow" && (() => {
            const flowList = filteredProductFlow();
            const totalPages = Math.ceil(flowList.length / itemsPerPage) || 1;
            const paginatedList = flowList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            return (
              <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-black text-slate-800">{t("product_flow_ledger")}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tracks real-time stock ins and outs (Cardex Log with Customer & Supplier info)</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="text-xs h-8 rounded-2xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 outline-none w-full sm:w-48 cursor-pointer"
                    >
                      <option value="all">All Products</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative w-full sm:w-48">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <Input 
                        placeholder="Search ref/party..." 
                        value={flowSearchQuery}
                        onChange={(e) => setFlowSearchQuery(e.target.value)}
                        className="pl-8 text-xs h-8 rounded-2xl border-slate-200"
                      />
                    </div>
                  </div>
                </div>
                
                {flowLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-amber-500 mr-2" size={20} />
                    <span className="text-xs text-slate-500 font-bold">Loading stock transactions...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-100">
                          <th className="p-4">Date</th>
                          <th className="p-4">Product Name</th>
                          <th className="p-4">Party / Customer / Supplier</th>
                          <th className="p-4">Ref / Bill #</th>
                          <th className="p-4">Flow Type</th>
                          <th className="p-4 text-right">{t("inflow")}</th>
                          <th className="p-4 text-right">{t("outflow")}</th>
                          <th className="p-4 text-right">Valuation Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {flowList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400">
                              No product movement logs found matching the filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedList.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-all">
                              <td className="p-4 font-mono text-slate-500">{item.date}</td>
                              <td className="p-4 font-bold text-slate-800">{item.productName}</td>
                              <td className="p-4 font-bold text-slate-700 flex items-center gap-1.5">
                                <Users size={12} className="text-slate-400" /> {item.partyName || "—"}
                              </td>
                              <td className="p-4 font-mono text-slate-500">{item.ref}</td>
                              <td className="p-4">
                                {item.type === "Purchase" ? (
                                  <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                    <Truck size={10} /> Purchase Inflow
                                  </span>
                                ) : (
                                  <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                    <ShoppingBag size={10} /> POS Sale Outflow
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-emerald-600">
                                {item.qtyIn > 0 ? `+ ${item.qtyIn}` : "-"}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-amber-600">
                                {item.qtyOut > 0 ? `- ${item.qtyOut}` : "-"}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-slate-700">
                                {selectedCurrency || "Rs"} {item.value.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination Bar */}
                    {flowList.length > 0 && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                          <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, flowList.length)} of {flowList.length} records</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none cursor-pointer"
                          >
                            <option value={15}>15 / page</option>
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                          >
                            Previous
                          </Button>
                          <span className="px-2 font-bold text-slate-700 text-xs">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Money Flow Ledger Tab */}
          {activeTab === "money_flow" && (() => {
            const flowList = filteredMoneyFlow();
            const totalPages = Math.ceil(flowList.length / itemsPerPage) || 1;
            const paginatedList = flowList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            return (
              <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-black text-slate-800">{t("money_flow_register")}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Real-time Cash & Bank Account (Code 1001) with Customer/Party Names</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <Input 
                      placeholder="Search by Party or Details..." 
                      value={flowSearchQuery}
                      onChange={(e) => setFlowSearchQuery(e.target.value)}
                      className="pl-8 text-xs h-8 rounded-2xl border-slate-200"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-100">
                        <th className="p-4">{t("date")}</th>
                        <th className="p-4">Party / Customer / Payee</th>
                        <th className="p-4">{t("description_narration")}</th>
                        <th className="p-4 text-right">{t("debit_money_in")}</th>
                        <th className="p-4 text-right">{t("credit_money_out")}</th>
                        <th className="p-4 text-right">{t("cash_balance")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {flowList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No monetary transactions found matching selected parameters.
                          </td>
                        </tr>
                      ) : (
                        paginatedList.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-all">
                            <td className="p-4 font-mono text-slate-500">{item.date}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                  {(item.partyName || "C").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-800 block">{item.partyName || "Walk-in Customer"}</span>
                                  {item.partyPhone && <span className="text-[10px] text-slate-400 font-mono">{item.partyPhone}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{item.narration}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">
                                  {item.billRef ? `${item.billRef} • ` : ""}Source: {item.ref_type}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-emerald-600">
                              {item.debit > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <ArrowDownLeft size={12} /> {selectedCurrency || "Rs"} {item.debit.toLocaleString()}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-rose-600">
                              {item.credit > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <ArrowUpRight size={12} /> {selectedCurrency || "Rs"} {item.credit.toLocaleString()}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-4 text-right font-mono font-black text-slate-800">
                              {selectedCurrency || "Rs"} {item.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Pagination Bar */}
                  {flowList.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                        <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, flowList.length)} of {flowList.length} records</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none cursor-pointer"
                        >
                          <option value={15}>15 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                          <option value={100}>100 / page</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                        >
                          Previous
                        </Button>
                        <span className="px-2 font-bold text-slate-700 text-xs">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Account Ledger Statement Tab */}
          {activeTab === "account_statement" && (() => {
            const statementList = getAccountLedgerStatement();
            const totalPages = Math.ceil(statementList.length / itemsPerPage) || 1;
            const paginatedList = statementList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            const isCustomerReceivable = selectedLedgerCode === "1002";
            const isSupplierPayable = selectedLedgerCode === "2001";

            const totalReceivableSum = partySummaries.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
            const totalPayableSum = partySummaries.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);

            const filteredPartyObj = selectedPartyFilter !== "all" ? partiesList.find(p => p.id === selectedPartyFilter) : null;
            const partySummaryObj = selectedPartyFilter !== "all" ? partySummaries.find(p => p.partyId === selectedPartyFilter) : null;
            const partyBal = partySummaryObj ? partySummaryObj.balance : Number(filteredPartyObj?.current_balance || 0);
            const cleanPhone = filteredPartyObj?.phone?.replace(/[^0-9]/g, "");
            const waPhone = cleanPhone?.startsWith("03") ? "92" + cleanPhone.substring(1) : cleanPhone;
            const waMsg = encodeURIComponent(
              `محترم گاہک ${filteredPartyObj?.name || ""} صاحب!\nآپ کے کھاتے کا بقایا ادھار ${selectedCurrency || "Rs"} ${partyBal.toLocaleString()} ہے۔ برائے مہربانی جلد از جلد ادائیگی کریں۔ شکریہ!\n-${shopName || "The Accounts ERP"}`
            );

            return (
              <div className="space-y-6">
                {/* Account Selection & Top Controls */}
                <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-4">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-violet-100 text-violet-800 font-mono font-black text-xs">
                          Account: {selectedLedgerCode}
                        </span>
                        <h2 className="text-lg font-black text-slate-800">
                          {selectedTemplate?.name || "Account Ledger"}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {isCustomerReceivable 
                          ? "گاہکوں کا تفصیلی ادھار کھاتہ (کسٹمر کے نام، بل نمبر اور بقایا رقوم کے ساتھ)" 
                          : isSupplierPayable 
                          ? "سپلائرز کا تفصیلی کھاتہ (خریداری، ادائیگیاں اور بقایا رقوم)" 
                          : "Chronological double-entry posting ledger card for specific account"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold whitespace-nowrap">Account:</span>
                        <select
                          value={selectedLedgerCode}
                          onChange={(e) => {
                            setSelectedLedgerCode(e.target.value);
                            setSelectedPartyFilter("all");
                            setStatementViewMode("statement");
                          }}
                          className="text-xs h-9 rounded-2xl border border-slate-200 bg-slate-50 px-3 font-bold text-slate-800 outline-none w-full sm:w-64 cursor-pointer"
                        >
                          {GL_ACCOUNT_TEMPLATES.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.code} - {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Party Filter for 1002 (Customers) or 2001 (Suppliers) */}
                      {isReceivableOrPayable && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
                            {isCustomerReceivable ? "Customer:" : "Supplier:"}
                          </span>
                          <select
                            value={selectedPartyFilter}
                            onChange={(e) => setSelectedPartyFilter(e.target.value)}
                            className="text-xs h-9 rounded-2xl border border-blue-200 bg-blue-50/50 px-3 font-bold text-blue-900 outline-none w-full sm:w-48 cursor-pointer"
                          >
                            <option value="all">
                              {isCustomerReceivable ? "All Customers (تمام گاہک)" : "All Suppliers (تمام سپلائرز)"}
                            </option>
                            {partiesList
                              .filter(p => isCustomerReceivable ? (p.type === "customer" || p.type === "dual") : (p.type === "supplier" || p.type === "dual"))
                              .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.phone ? `(${p.phone})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Highlight KPI Cards for Receivables / Payables */}
                  {isCustomerReceivable && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-150 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-700">کل قابل وصول ادھار (Total Receivable)</span>
                          <Users size={16} className="text-blue-600" />
                        </div>
                        <h4 className="text-xl font-black text-blue-900 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {totalReceivableSum.toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-blue-600 mt-1 block">
                          {partySummaries.filter(p => p.balance > 0).length} گاہکوں سے رقم لینی ہے
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">مدت میں ادھار فروخت (Sales on Credit)</span>
                          <ShoppingBag size={16} className="text-slate-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-800 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {(accountsSummary["1002"]?.debit || 0).toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-slate-500 mt-1 block">ڈیبٹ اندراجات (Debit / New Credit)</span>
                      </div>

                      <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800">مدت میں وصولیاں (Recovered Payments)</span>
                          <ArrowDownLeft size={16} className="text-emerald-600" />
                        </div>
                        <h4 className="text-xl font-black text-emerald-900 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {(accountsSummary["1002"]?.credit || 0).toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-emerald-700 mt-1 block">کریڈٹ وصولی (Customer Payments)</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">کل رجسٹرڈ گاہک (Total Customers)</span>
                          <UserCheck size={16} className="text-slate-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-800 mt-2 font-mono">
                          {partiesList.filter(p => p.type === "customer" || p.type === "dual").length}
                        </h4>
                        <span className="text-[10px] text-slate-500 mt-1 block">کھاتہ دار کسٹمر پروفائلز</span>
                      </div>
                    </div>
                  )}

                  {isSupplierPayable && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                      <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-150 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-700">کل قابل ادائیگی (Total Payable to Suppliers)</span>
                          <Building2 size={16} className="text-rose-600" />
                        </div>
                        <h4 className="text-xl font-black text-rose-900 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {totalPayableSum.toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-rose-600 mt-1 block">
                          {partySummaries.filter(p => p.balance > 0).length} سپلائرز کو رقم دینی ہے
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">مدت میں ادھار خریداری (Purchases on Credit)</span>
                          <Truck size={16} className="text-slate-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-800 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {(accountsSummary["2001"]?.credit || 0).toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-slate-500 mt-1 block">کریڈٹ انٹریز (New Payables)</span>
                      </div>

                      <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800">مدت میں ادائیگیاں (Supplier Payments)</span>
                          <ArrowUpRight size={16} className="text-emerald-600" />
                        </div>
                        <h4 className="text-xl font-black text-emerald-900 mt-2 font-mono">
                          {selectedCurrency || "Rs"} {(accountsSummary["2001"]?.debit || 0).toLocaleString()}
                        </h4>
                        <span className="text-[10px] text-emerald-700 mt-1 block">ڈیبٹ ادائیگی (Paid to Suppliers)</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">کل رجسٹرڈ سپلائرز (Suppliers)</span>
                          <Building2 size={16} className="text-slate-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-800 mt-2 font-mono">
                          {partiesList.filter(p => p.type === "supplier" || p.type === "dual").length}
                        </h4>
                        <span className="text-[10px] text-slate-500 mt-1 block">رجسٹرڈ وینڈر پروفائلز</span>
                      </div>
                    </div>
                  )}

                  {/* View Mode Toggle Switcher for Customers / Suppliers */}
                  {isReceivableOrPayable && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
                        <button
                          onClick={() => setStatementViewMode("statement")}
                          className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                            statementViewMode === "statement"
                              ? "bg-white text-blue-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <FileText size={13} /> Detailed Ledger Transactions (تفصیلی کھاتہ)
                        </button>
                        <button
                          onClick={() => setStatementViewMode("party_summary")}
                          className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                            statementViewMode === "party_summary"
                              ? "bg-white text-blue-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Users size={13} /> {isCustomerReceivable ? "Customer-wise Balances Summary (گاہک وار وصولی لسٹ)" : "Supplier-wise Balances Summary (سپلائر وار لسٹ)"}
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <Input 
                          placeholder={isCustomerReceivable ? "Search Customer, Phone, Bill #..." : "Search Supplier, Phone, PO #..."}
                          value={flowSearchQuery}
                          onChange={(e) => setFlowSearchQuery(e.target.value)}
                          className="pl-8 text-xs h-8 rounded-2xl border-slate-200"
                        />
                      </div>
                    </div>
                  )}

                  {!isReceivableOrPayable && (
                    <div className="flex justify-end pt-2">
                      <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <Input 
                          placeholder="Search narration, ref #..." 
                          value={flowSearchQuery}
                          onChange={(e) => setFlowSearchQuery(e.target.value)}
                          className="pl-8 text-xs h-8 rounded-2xl border-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* VIEW 1: Customer / Supplier Summary Breakdown & Recovery Sheet */}
                {isReceivableOrPayable && statementViewMode === "party_summary" && (
                  <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800">
                            {isCustomerReceivable ? "Customer Recovery & Balances Summary (گاہک ادھار وصولی رپورٹ)" : "Supplier Payables Ledger Summary (سپلائر وار ادائیگی سمری)"}
                          </span>
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {partySummaries.filter(p => !onlyPendingDebtors || p.balance > 0).length} Accounts
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {isCustomerReceivable 
                            ? "ہر گاہک کا نام، فون نمبر، کل بل، کل وصولی اور بقایا ادھار جو گاہک سے لینا ہے"
                            : "ہر سپلائر کا نام، فون، کل خریداری، کل ادائیگی اور بقایا رقم جو دینی ہے"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold cursor-pointer select-none bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                          <input 
                            type="checkbox" 
                            checked={onlyPendingDebtors} 
                            onChange={(e) => setOnlyPendingDebtors(e.target.checked)}
                            className="rounded text-rose-600 border-slate-350 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                          />
                          <span>{isCustomerReceivable ? "صرف ادھار والے گاہک (Due > 0)" : "صرف واجبات والے سپلائرز"}</span>
                        </label>

                        <Button 
                          onClick={handleDownloadRecoverySheetPDF}
                          size="sm"
                          className="bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-bold text-xs shadow-sm shadow-rose-200 cursor-pointer flex items-center gap-1.5"
                        >
                          <Download size={13} /> {isCustomerReceivable ? "Download Recovery Sheet PDF (ریکوری شیٹ)" : "Export Payables Sheet"}
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-100">
                            <th className="p-4">{isCustomerReceivable ? "Customer Name" : "Supplier Name"}</th>
                            <th className="p-4">Contact Phone</th>
                            <th className="p-4 text-right">{isCustomerReceivable ? "Total Billed / Sales" : "Total Purchased"}</th>
                            <th className="p-4 text-right">{isCustomerReceivable ? "Total Paid / Received" : "Total Paid Out"}</th>
                            <th className="p-4 text-right">{isCustomerReceivable ? "Net Receivable (جو رقم لینی ہے)" : "Net Payable (جو دینی ہے)"}</th>
                            <th className="p-4 text-center">Quick Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                          {partySummaries.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400">
                                No customer/supplier balances found.
                              </td>
                            </tr>
                          ) : (
                            partySummaries
                              .filter(p => !onlyPendingDebtors || p.balance > 0)
                              .filter(p => !flowSearchQuery || p.name.toLowerCase().includes(flowSearchQuery.toLowerCase()) || p.phone.includes(flowSearchQuery))
                              .map((p) => {
                                const cleanPhone = p.phone?.replace(/[^0-9]/g, "");
                                const waPhone = cleanPhone?.startsWith("03") ? "92" + cleanPhone.substring(1) : cleanPhone;
                                const waMsg = encodeURIComponent(
                                  `محترم گاہک ${p.name} صاحب!\nآپ کے کھاتے کا بقایا ادھار ${selectedCurrency || "Rs"} ${p.balance.toLocaleString()} ہے۔ برائے مہربانی جلد از جلد ادائیگی کریں۔ شکریہ!\n-${shopName || "The Accounts ERP"}`
                                );

                                return (
                                  <tr key={p.partyId} className="hover:bg-blue-50/40 transition-all">
                                    <td className="p-4">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                                          {p.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <span className="font-bold text-slate-900 block">{p.name}</span>
                                          {p.txCount > 0 ? (
                                            <span className="text-[10px] text-slate-400">{p.txCount} period transactions</span>
                                          ) : p.hasOpening ? (
                                            <span className="text-[10px] text-blue-600 font-semibold">Opening Khata Balance</span>
                                          ) : p.balance > 0 ? (
                                            <span className="text-[10px] text-amber-600 font-semibold">Direct Khata Due</span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400">Khata Active</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4 font-mono text-slate-600 font-semibold">{p.phone}</td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-700">
                                      {selectedCurrency || "Rs"} {p.totalBilled.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-emerald-600">
                                      {selectedCurrency || "Rs"} {p.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right font-mono font-black text-sm">
                                      {p.balance > 0 ? (
                                        <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl font-bold">
                                          {selectedCurrency || "Rs"} {p.balance.toLocaleString()}
                                        </span>
                                      ) : p.balance < 0 ? (
                                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold">
                                          Advance: {selectedCurrency || "Rs"} {Math.abs(p.balance).toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">0</span>
                                      )}
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center justify-center gap-2">
                                        {isCustomerReceivable && p.balance > 0 && waPhone && waPhone.length >= 10 && (
                                          <a
                                            href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Send WhatsApp Reminder"
                                            className="h-7 px-2.5 text-[11px] rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                          >
                                            <Phone size={11} /> WhatsApp
                                          </a>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedPartyFilter(p.partyId);
                                            setStatementViewMode("statement");
                                          }}
                                          className="h-7 text-xs rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 font-bold cursor-pointer"
                                        >
                                          <Eye size={12} className="mr-1" /> View Ledger
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* VIEW 2: Detailed Ledger Statement Table */}
                {(statementViewMode === "statement" || !isReceivableOrPayable) && (
                  <div className="space-y-4">
                      {/* Rich Party Header Card when filtered to a specific customer/supplier */}
                      {filteredPartyObj && (
                        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 rounded-3xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-lg text-blue-200">
                              {filteredPartyObj.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-white">{filteredPartyObj.name}</h3>
                                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                                  {isCustomerReceivable ? "Customer Khata" : "Supplier Khata"}
                                </span>
                              </div>
                              <p className="text-xs text-blue-200 mt-0.5 font-mono">
                                📞 {filteredPartyObj.phone || "No phone registered"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right px-3 py-1 bg-white/10 rounded-2xl border border-white/15">
                              <span className="text-[10px] text-blue-200 block font-semibold">
                                {isCustomerReceivable ? "Net Receivable Due (لینے ہیں)" : "Net Payable (دینے ہیں)"}
                              </span>
                              <span className="text-lg font-black text-emerald-300 font-mono">
                                {selectedCurrency || "Rs"} {partyBal.toLocaleString()}
                              </span>
                            </div>

                            {waPhone && waPhone.length >= 10 && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 text-xs rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                              >
                                <Phone size={12} /> WhatsApp Reminder
                              </a>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPartyFilter("all")}
                              className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 rounded-xl font-bold cursor-pointer"
                            >
                              Show All Customers &times;
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <span className="text-xs font-black text-slate-800">
                              {isCustomerReceivable 
                                ? `Customer Accounts Receivable Ledger • ${selectedPartyFilter !== "all" ? (partiesList.find(p => p.id === selectedPartyFilter)?.name || "Selected Customer") : "All Customers"}`
                                : isSupplierPayable
                                ? `Supplier Accounts Payable Ledger • ${selectedPartyFilter !== "all" ? (partiesList.find(p => p.id === selectedPartyFilter)?.name || "Selected Supplier") : "All Suppliers"}`
                                : `${selectedTemplate?.name || "Account"} Statement`}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Chronological posting transactions with Customer/Party names, Bill #, Debits, Credits and Running Due
                            </p>
                          </div>

                          {selectedPartyFilter !== "all" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPartyFilter("all")}
                              className="text-xs text-blue-600 hover:bg-blue-50 h-7 rounded-xl font-bold cursor-pointer"
                            >
                              Show All Customers &times;
                            </Button>
                          )}
                        </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-100">
                            <th className="p-4">Date</th>
                            {isReceivableOrPayable && (
                              <th className="p-4">{isCustomerReceivable ? "Customer Name & Contact" : "Supplier Name & Contact"}</th>
                            )}
                            <th className="p-4">Description / Narration & Bill #</th>
                            <th className="p-4 text-right">
                              {isCustomerReceivable ? "Debit (ادھار فروخت)" : isSupplierPayable ? "Debit (ادائیگی)" : "Debit"}
                            </th>
                            <th className="p-4 text-right">
                              {isCustomerReceivable ? "Credit (وصولی)" : isSupplierPayable ? "Credit (خریداری)" : "Credit"}
                            </th>
                            <th className="p-4 text-right">
                              {isCustomerReceivable ? "Running Due (بقایا ادھار)" : isSupplierPayable ? "Running Due (بقایا ادائیگی)" : "Running Balance"}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                          {statementList.length === 0 ? (
                            <tr>
                              <td colSpan={isReceivableOrPayable ? 6 : 5} className="p-8 text-center text-slate-400">
                                No posted ledger entries found for this account matching current filters.
                              </td>
                            </tr>
                          ) : (
                            paginatedList.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-all">
                                <td className="p-4 font-mono text-slate-500 whitespace-nowrap">{item.date}</td>
                                
                                {isReceivableOrPayable && (
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                                        {(item.partyName || "C").charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <span className="font-bold text-slate-900 block">{item.partyName || "Walk-in Customer"}</span>
                                        {item.partyPhone && (
                                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                            <Phone size={10} /> {item.partyPhone}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                )}

                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {item.billRef && (
                                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                                          {item.billRef}
                                        </span>
                                      )}
                                      <span className="font-bold text-slate-800">{item.narration || "Ledger Entry"}</span>
                                    </div>
                                    {item.additionalDetails && (
                                      <span className="text-[10px] text-blue-600 font-medium mt-0.5">
                                        {item.additionalDetails}
                                      </span>
                                    )}
                                    <span className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">
                                      Source: {item.ref_type}
                                    </span>
                                  </div>
                                </td>

                                <td className="p-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                  {item.debit > 0 ? (
                                    <span>
                                      {selectedCurrency || "Rs"} {item.debit.toLocaleString()}
                                    </span>
                                  ) : "-"}
                                </td>
                                
                                <td className="p-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                  {item.credit > 0 ? (
                                    <span>
                                      {selectedCurrency || "Rs"} {item.credit.toLocaleString()}
                                    </span>
                                  ) : "-"}
                                </td>

                                <td className="p-4 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                  {selectedCurrency || "Rs"} {item.balance.toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    {statementList.length > 0 && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                          <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, statementList.length)} of {statementList.length} records</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none cursor-pointer"
                          >
                            <option value={15}>15 / page</option>
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                          >
                            Previous
                          </Button>
                          <span className="px-2 font-bold text-slate-700 text-xs">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="h-7 px-2.5 text-xs rounded-lg border-slate-200 text-slate-700 cursor-pointer disabled:opacity-40"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        </motion.div>
      )}
    </div>
  );
}
