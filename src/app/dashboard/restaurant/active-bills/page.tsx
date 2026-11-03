"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Receipt, Search, Printer, CreditCard, ChevronRight, 
  Loader2, Check, X, Users, DollarSign, Clock, RefreshCw, AlertCircle,
  Plus, Minus, Trash2, Edit, ChefHat
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import {
  type RestaurantOrderStatus,
  RESTAURANT_ORDER_STATUS_LABELS,
  canSettleOrder,
  markBillPrinted,
  markOrderSettled,
} from "@/lib/restaurant-orders";
import {
  countKitchenTicketsForInvoice,
  dispatchKitchenTicket,
} from "@/lib/restaurant-kitchen";
import { printRestaurantPaidReceipt } from "@/lib/restaurant-receipt-print";

type InvoiceItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    purchase_price_single: number;
  } | null;
};

type DraftInvoice = {
  id: string;
  created_at: string;
  total_amount: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  party_id: string | null;
  payment_mode: string | null;
  status: string;
  waiter_id?: string | null;
  rider_id?: string | null;
  restaurant_order_status?: RestaurantOrderStatus | null;
  bill_printed_at?: string | null;
  service_type?: string | null;
  parties: {
    name: string;
  } | null;
  invoice_items: InvoiceItem[];
  tableName?: string; // Resolved dining table name if any
  tableId?: string; // Resolved dining table ID if any
};

type DBTable = {
  id: string;
  name: string;
  active_invoice_id: string | null;
};

type CashAccount = {
  id: string;
  name: string;
  current_balance: number;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
};

export default function ActiveBillsPage() {
  const { shopId, userId, shopName } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [bills, setBills] = useState<DraftInvoice[]>([]);
  const [tables, setTables] = useState<DBTable[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<DraftInvoice | null>(null);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  // Settlement & Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [isSendingKot, setIsSendingKot] = useState(false);
  const [kitchenTicketCount, setKitchenTicketCount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "credit">("cash");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [discountVal, setDiscountVal] = useState<number>(0);
  const [taxRateVal, setTaxRateVal] = useState<number>(0);

  // Calculations for Checkout Dialog
  const subtotal = selectedBill?.invoice_items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;
  const taxAmount = (subtotal * taxRateVal) / 100;
  const netTotal = Math.max(0, subtotal + taxAmount - discountVal);
  const remainingDue = Math.max(0, netTotal - receivedAmount);

  // Time Tracker State to refresh timestamps
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const getMinutesAgo = (timeStr: string) => {
    const diffMs = new Date().getTime() - new Date(timeStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 0) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    return `${diffHrs}h ago`;
  };

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch tables
      const { data: tablesData } = await supabase
        .from("restaurant_tables")
        .select("id, name, active_invoice_id")
        .eq("shop_id", shopId);
      setTables(tablesData || []);

      // 2. Fetch draft invoices
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select(`
          id,
          created_at,
          total_amount,
          discount,
          tax_rate,
          tax_amount,
          party_id,
          payment_mode,
          status,
          waiter_id,
          rider_id,
          restaurant_order_status,
          bill_printed_at,
          service_type,
          parties ( name ),
          invoice_items (
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            products ( name, purchase_price_single )
          )
        `)
        .eq("shop_id", shopId)
        .eq("status", "draft")
        .order("created_at", { ascending: false });

      if (invErr) throw invErr;

      // Map tables to draft invoices
      const mappedBills: DraftInvoice[] = (invData || []).map((inv: any) => {
        const associatedTable = (tablesData || []).find((t: any) => t.active_invoice_id === inv.id);
        return {
          ...inv,
          tableName: associatedTable ? associatedTable.name : "Takeaway Order",
          tableId: associatedTable ? associatedTable.id : undefined
        };
      });

      setBills(mappedBills);

      // Keep selection in sync or default to first
      if (selectedBill) {
        const updated = mappedBills.find(b => b.id === selectedBill.id);
        setSelectedBill(updated || null);
      } else if (mappedBills.length > 0) {
        setSelectedBill(mappedBills[0]);
      } else {
        setSelectedBill(null);
      }

      // 3. Fetch products
      const prodRes = await supabase
        .from("products")
        .select("id, name, sale_price_single, purchase_price_single, is_ingredient")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      
      let productsData: any[] | null = null;
      if (prodRes.error) {
        if (prodRes.error.message.includes("is_ingredient") || prodRes.error.hint?.includes("is_ingredient")) {
          const fallback = await supabase
            .from("products")
            .select("id, name, sale_price_single, purchase_price_single")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (!fallback.error) {
            productsData = (fallback.data || []).map((p: any) => ({ ...p, is_ingredient: false }));
          }
        }
      } else {
        productsData = prodRes.data;
      }
      if (productsData) {
        setProducts(
          productsData.filter(
            (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
          )
        );
      }

      // 4. Fetch accounts
      const { data: accData } = await supabase
        .from("cash_accounts")
        .select("id, name, current_balance")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      setCashAccounts(accData || []);
      if (accData && accData.length > 0) {
        const cashInHand = accData.find((a: any) => a.name.toLowerCase() === "cash in hand");
        setSelectedAccountId(cashInHand ? cashInHand.id : accData[0].id);
      }

      // 5. Fetch customers
      const { data: custData } = await supabase
        .from("parties")
        .select("id, name, phone, current_balance")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });
      setCustomers(custData || []);

      // 6. Fetch print settings
      const { data: printData } = await supabase
        .from("print_settings")
        .select("*")
        .eq("shop_id", shopId)
        .maybeSingle();
      if (printData) setReceiptSettings(printData);

      // 7. Fetch company details
      const { data: companyData } = await supabase
        .from("company_details")
        .select("*")
        .eq("shop_id", shopId)
        .maybeSingle();
      if (companyData) setCompanyDetails(companyData);

      // 8. Fetch active register session
      if (userId) {
        const { data: sessionData } = await supabase
          .from("register_sessions")
          .select("*")
          .eq("shop_id", shopId)
          .eq("user_id", userId)
          .eq("status", "open")
          .maybeSingle();
        setActiveSession(sessionData || null);
      }

      // 9. Fetch Staff profiles for waiter/rider selectors
      const { data: staffData } = await supabase
        .from("user_profiles")
        .select("id, name, role")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      setStaff(staffData || []);

    } catch (err: any) {
      toast.error("Failed to load active bills: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shopId) return;
    loadData();

    // Subscribe to live tables and invoices changes
    const realtimeChannel = supabase
      .channel("active_bills_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `shop_id=eq.${shopId}` }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `shop_id=eq.${shopId}` }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [shopId]);

  useEffect(() => {
    if (!selectedBill?.id) {
      setKitchenTicketCount(0);
      return;
    }
    countKitchenTicketsForInvoice(supabase, selectedBill.id).then(setKitchenTicketCount);
  }, [selectedBill?.id, supabase, bills]);

  const handleSendKitchenTicket = async () => {
    if (!shopId || !selectedBill) return;
    const lines = (selectedBill.invoice_items || []).map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      remarks: null as string | null,
    }));
    if (!lines.length) {
      toast.error(
        language === "en" ? "Add items to the bill before sending KOT." : "پہلے بل میں اشیاء شامل کریں۔"
      );
      return;
    }
    setIsSendingKot(true);
    try {
      await dispatchKitchenTicket(supabase, {
        shopId,
        invoiceId: selectedBill.id,
        tableId: selectedBill.tableId || null,
        waiterId: selectedBill.waiter_id || null,
        lines,
      });
      const count = await countKitchenTicketsForInvoice(supabase, selectedBill.id);
      setKitchenTicketCount(count);
      toast.success(
        language === "en" ? "KOT sent - open Kitchen KDS or KOT Queue." : "KOT کچن میں - KDS کھولیں۔"
      );
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to send KOT");
    } finally {
      setIsSendingKot(false);
    }
  };

  // Edit Mode Operations
  const startEditing = () => {
    if (!selectedBill) return;
    setEditItems(JSON.parse(JSON.stringify(selectedBill.invoice_items)));
    setIsEditing(true);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const adjustEditQty = (productId: string, amount: number) => {
    setEditItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.quantity + amount);
        return {
          ...item,
          quantity: newQty,
          subtotal: item.unit_price * newQty
        };
      }
      return item;
    }));
  };

  const deleteEditItem = (productId: string) => {
    setEditItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const addProductToEditBill = (prod: any) => {
    const exists = editItems.find(item => item.product_id === prod.id);
    if (exists) {
      adjustEditQty(prod.id, 1);
    } else {
      const newItem: InvoiceItem = {
        id: crypto.randomUUID(),
        product_id: prod.id,
        quantity: 1,
        unit_price: Number(prod.sale_price_single || 0),
        subtotal: Number(prod.sale_price_single || 0),
        products: {
          name: prod.name,
          purchase_price_single: Number(prod.purchase_price_single || 0)
        }
      };
      setEditItems(prev => [...prev, newItem]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
    toast.success(`${prod.name} added to bill.`);
  };

  const handleSaveBillEdits = async () => {
    if (!selectedBill) return;
    if (editItems.length === 0) {
      toast.error("Cannot save an empty bill. Please settle or delete it.");
      return;
    }
    setIsSavingEdits(true);
    try {
      const invoiceId = selectedBill.id;

      // 1. Delete previous invoice items
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

      // 2. Insert new ones
      const itemsToInsert = editItems.map(item => ({
        invoice_id: invoiceId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity
      }));

      const { error: insertErr } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (insertErr) throw insertErr;

      // 3. Recalculate totals
      const newSubtotal = editItems.reduce((sum, item) => sum + item.subtotal, 0);
      const newTaxAmount = (newSubtotal * (selectedBill.tax_rate || 0)) / 100;
      const newNetTotal = Math.max(0, newSubtotal + newTaxAmount - (selectedBill.discount || 0));

      // 4. Update invoices table
      const { error: invErr } = await supabase
        .from("invoices")
        .update({
          total_amount: newNetTotal,
          tax_amount: newTaxAmount
        })
        .eq("id", invoiceId);

      if (invErr) throw invErr;

      toast.success("Bill updated successfully!");
      setIsEditing(false);
      
      // Reload active bills list and sync selected bill
      await loadData();
    } catch (err: any) {
      toast.error("Failed to save bill changes: " + err.message);
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleOpenCheckout = () => {
    if (!selectedBill) return;
    const orderStatus = selectedBill.restaurant_order_status;
    if (orderStatus && !canSettleOrder(orderStatus)) {
      toast.error(language === "en"
        ? "Print guest bill first before settlement."
        : "ادائیگی سے پہلے مہمان کا بل پرنٹ کریں۔");
      return;
    }
    setDiscountVal(selectedBill.discount || 0);
    setTaxRateVal(selectedBill.tax_rate || 0);
    setReceivedAmount(selectedBill.total_amount);
    setSelectedCustomerId(selectedBill.party_id || "walkin");
    setSelectedWaiterId(selectedBill.waiter_id || "");
    setSelectedRiderId(selectedBill.rider_id || "");
    setIsCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    if (!selectedBill) return;
    setIsSubmittingCheckout(true);
    try {
      const activeInvoiceId = selectedBill.id;

      // 1. Update Invoice Items & Details
      await supabase.from("invoice_items").delete().eq("invoice_id", activeInvoiceId);

      await supabase.from("invoice_items").insert(
        selectedBill.invoice_items.map(item => ({
          invoice_id: activeInvoiceId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.unit_price * item.quantity
        }))
      );

      // Settle the main invoice
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .update({
          party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
          total_amount: netTotal,
          discount: discountVal,
          tax_rate: taxRateVal,
          tax_amount: taxAmount,
          status: paymentMode === "credit" ? (receivedAmount > 0 ? "partial" : "unpaid") : "paid",
          paid_amount: paymentMode === "credit" ? receivedAmount : netTotal,
          payment_mode: paymentMode,
          register_session_id: activeSession ? activeSession.id : null,
          account_id: paymentMode !== "credit" ? selectedAccountId : null,
          waiter_id: selectedWaiterId ? selectedWaiterId : null,
          rider_id: selectedRiderId ? selectedRiderId : null,
          restaurant_order_status: "settled",
        })
        .eq("id", activeInvoiceId)
        .select()
        .single();

      if (invErr) throw invErr;
      await markOrderSettled(supabase, activeInvoiceId);

      // 2. Decrement Product Stock levels (BOM Recipe stock reduction)
      for (const item of selectedBill.invoice_items) {
        const { data: recipeItems } = await supabase
          .from("product_recipes")
          .select("ingredient_product_id, quantity")
          .eq("parent_product_id", item.product_id);

        if (recipeItems && recipeItems.length > 0) {
          // Decrement stock of ingredients
          for (const rec of recipeItems) {
            await supabase.rpc("decrement_product_stock", {
              p_id: rec.ingredient_product_id,
              qty: Number(rec.quantity) * item.quantity
            });
          }
        } else {
          // Direct menu product stock decrement
          await supabase.rpc("decrement_product_stock", {
            p_id: item.product_id,
            qty: item.quantity
          });
        }
      }

      // 3. Handle Cash Ledger Entry
      const paidAmt = paymentMode === "credit" ? receivedAmount : netTotal;
      if (paymentMode !== "credit" || paidAmt > 0) {
        const currentAcc = cashAccounts.find(a => a.id === selectedAccountId);
        if (currentAcc) {
          await supabase
            .from("cash_accounts")
            .update({ current_balance: Number(currentAcc.current_balance || 0) + paidAmt })
            .eq("id", selectedAccountId);
        }

        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: selectedAccountId,
          type: "deposit",
          amount: paidAmt,
          ref_type: "invoice",
          ref_id: activeInvoiceId,
          remarks: `Restaurant POS Checkout - Bill #${activeInvoiceId.slice(0, 8).toUpperCase()}`,
        });
      }

      // 4. Handle Credit Sale updates
      if (paymentMode === "credit" && remainingDue > 0 && selectedCustomerId !== "walkin") {
        await supabase.rpc("increment_party_balance", {
          p_id: selectedCustomerId,
          amount: remainingDue
        });

        await supabase.from("credit_transactions").insert({
          shop_id: shopId,
          customer_id: selectedCustomerId,
          amount: remainingDue,
          transaction_type: "charge",
          remarks: `Credit Sale extended on Restaurant Bill #${activeInvoiceId.slice(0, 8).toUpperCase()}`,
        });
      }

      // 5. If dining, disassociate the table
      if (selectedBill.tableId) {
        await supabase
          .from("restaurant_tables")
          .update({
            active_invoice_id: null,
            status: "cleaning"
          })
          .eq("id", selectedBill.tableId);
      }

      toast.success("Bill checked out - printing thermal receipt…");
      setIsCheckoutOpen(false);

      printRestaurantPaidReceipt(
        {
          invoiceId: activeInvoiceId,
          orderNumber: null,
          tableName: selectedBill.tableName,
          serviceType: selectedBill.service_type,
          customerName:
            customers.find((c) => c.id === selectedCustomerId)?.name ||
            selectedBill.parties?.name ||
            "Walk-in Guest",
          paymentMode,
          items: selectedBill.invoice_items.map((item) => ({
            name: item.products?.name || "Item",
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          subtotal,
          discount: discountVal,
          taxRate: taxRateVal,
          taxAmount,
          netTotal,
          paidAmount: paidAmt,
          remainingDue,
          settings: receiptSettings,
          shopDetails: {
            name: companyDetails?.name || shopName || "Restaurant",
            phone: companyDetails?.phone,
            address: companyDetails?.address,
            email: companyDetails?.email,
          },
          createdAt: selectedBill.created_at,
        },
        {
          onError: (msg) =>
            toast.error(
              language === "en"
                ? `${msg} Set thermal as default printer in Windows.`
                : `${msg} Windows میں تھرمل پرنٹر ڈیفالٹ کریں۔`
            ),
        }
      );
      
      // Reload active queue
      loadData();
    } catch (err: any) {
      toast.error("Checkout failed: " + err.message);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const printGuestReceipt = async (billObj: DraftInvoice, settledInv?: any, paidAmt?: number, remDue?: number) => {
    if (!settledInv && billObj.status === "draft") {
      try {
        await markBillPrinted(supabase, billObj.id);
        setBills(prev => prev.map(b => b.id === billObj.id
          ? { ...b, restaurant_order_status: "bill_printed" as RestaurantOrderStatus, bill_printed_at: new Date().toISOString() }
          : b));
        if (selectedBill?.id === billObj.id) {
          setSelectedBill(prev => prev ? { ...prev, restaurant_order_status: "bill_printed", bill_printed_at: new Date().toISOString() } : prev);
        }
      } catch (e: any) {
        toast.error(e.message);
      }
    }

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const invoiceId = settledInv?.id || billObj.id;
    const finalNet = settledInv?.total_amount || billObj.total_amount;
    const finalPaid = paidAmt !== undefined ? paidAmt : finalNet;
    const finalDue = remDue !== undefined ? remDue : 0;
    const mode = settledInv?.payment_mode || "Cash";

    let iframe = document.getElementById("active-bill-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "active-bill-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("Printing failed: Could not access printer frame.");
      return;
    }

    let fontFaceStyle = "";
    if (receiptSettings?.fontFamily === "urdu") {
      fontFaceStyle = `
        @font-face {
          font-family: 'Nastaliq';
          src: url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
        }
      `;
    }

    let paperStyle = "@page { margin: 0; }";
    if (receiptSettings?.pageSize === "MM80") {
      paperStyle += " body { width: 80mm; }";
    } else if (receiptSettings?.pageSize === "MM58") {
      paperStyle += " body { width: 58mm; }";
    } else if (receiptSettings?.pageSize === "A5") {
      paperStyle += " body { width: 148mm; }";
    }

    const itemsHTML = billObj.invoice_items.map((item, idx) => `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-1 text-slate-800">${idx + 1}. ${item.products?.name || "Unknown Item"}</td>
        <td class="py-1 text-center text-slate-600">${item.quantity}</td>
        <td class="py-1 text-right text-slate-600">${item.unit_price}</td>
        <td class="py-1 text-right font-semibold text-slate-800">${item.subtotal}</td>
      </tr>
    `).join("");

    const printHTML = `
      <div class="p-4 bg-white text-slate-800 w-full" style="font-family: ${receiptSettings?.fontFamily === 'urdu' ? 'Nastaliq, sans-serif' : 'Arial, sans-serif'}">
        <div class="text-center mb-3">
          <h1 class="text-lg font-bold uppercase tracking-wide text-slate-900">${companyDetails?.name || shopName || "The Accounts Restaurant"}</h1>
          <p class="text-xs text-slate-500 mt-0.5">${companyDetails?.address || "Main Food Street, Lahore"}</p>
          <p class="text-xs text-slate-500">${companyDetails?.phone || "03001234567"}</p>
        </div>
        
        <div class="border-t border-b border-slate-200 py-2 mb-3 text-xs flex flex-col gap-1 text-slate-600">
          <div class="flex justify-between">
            <div>Bill No: <strong class="text-slate-800">#${invoiceId.slice(0, 8).toUpperCase()}</strong></div>
            <div>Date: ${new Date(billObj.created_at).toLocaleDateString()}</div>
          </div>
          <div class="flex justify-between">
            <div>Customer: ${selectedCustomer?.name || "Walk-in Guest"}</div>
            <div>Source: <strong class="text-blue-600">${billObj.tableName}</strong></div>
          </div>
        </div>

        <table class="w-full text-left mb-4">
          <thead>
            <tr class="border-b border-slate-300 text-xs font-bold text-slate-700">
              <th class="py-1">Item</th>
              <th class="py-1 text-center">Qty</th>
              <th class="py-1 text-right">Price</th>
              <th class="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="flex flex-col gap-1 text-xs border-t border-slate-200 pt-2 mb-4">
          <div class="flex justify-between text-slate-600">
            <div>Subtotal:</div>
            <div>${subtotal}</div>
          </div>
          ${billObj.discount > 0 ? `
          <div class="flex justify-between text-red-600 font-medium">
            <div>Discount:</div>
            <div>-${billObj.discount}</div>
          </div>
          ` : ""}
          ${billObj.tax_amount > 0 ? `
          <div class="flex justify-between text-slate-600">
            <div>Tax (${billObj.tax_rate}%):</div>
            <div>+${billObj.tax_amount}</div>
          </div>
          ` : ""}
          <div class="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1 text-sm">
            <div>Net Total:</div>
            <div>PKR ${finalNet}</div>
          </div>
          <div class="flex justify-between text-slate-600 pt-1">
            <div>Paid Amount (${mode}):</div>
            <div>PKR ${finalPaid}</div>
          </div>
          ${finalDue > 0 ? `
          <div class="flex justify-between text-red-600 font-bold">
            <div>Remaining Due:</div>
            <div>PKR ${finalDue}</div>
          </div>
          ` : ""}
        </div>

        <div class="text-center border-t border-dashed border-slate-200 pt-3 mt-4 text-xs text-slate-500">
          <p class="font-medium text-slate-700">${receiptSettings?.footerText || "Thank you for dining with us!"}</p>
          <p class="text-[10px] mt-0.5">Software Powered by The Accounts</p>
        </div>
      </div>
    `;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Guest Bill #${invoiceId.slice(0, 8).toUpperCase()}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${fontFaceStyle}
            ${paperStyle}
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          <div class="flex justify-center items-start w-full">
            ${printHTML}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch = 
      (b.tableName || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/restaurant/pos">
            <Button variant="outline" className="border-slate-200 text-slate-600">
              POS Desk
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/kds">
            <Button variant="outline" className="border-slate-200 text-slate-600">
              <ChefHat className="mr-2 h-4 w-4" /> Kitchen KDS
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/kot">
            <Button variant="outline" className="border-slate-200 text-slate-600">
              KOT Queue
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={loadData}
            className="border-slate-200 text-slate-600 hover:text-slate-800"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> 
            {language === "en" ? "Refresh Queue" : "ریفریش"}
          </Button>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
            <Receipt className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {language === "en" ? "No Active Bills Found" : "کوئی چلتا بل موجود نہیں ہے"}
          </h3>
          
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Active Queue List (Left Side - 5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder={language === "en" ? "Search table or bill ID..." : "ٹیبل یا بل نمبر تلاش کریں..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              <AnimatePresence>
                {filteredBills.map((bill) => {
                  const isSelected = selectedBill?.id === bill.id;
                  const totalItems = bill.invoice_items.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <motion.div
                      key={bill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => {
                        setSelectedBill(bill);
                        setIsEditing(false); // Cancel edit on switch
                      }}
                      className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden ${
                        isSelected 
                          ? "bg-slate-900 border-slate-900 text-white" 
                          : "bg-white hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors border-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isSelected 
                              ? "bg-slate-800 text-blue-400" 
                              : "bg-blue-50 text-blue-600"
                          }`}>
                            {bill.tableName}
                          </div>
                          <h4 className="font-extrabold text-sm mt-1.5 flex items-center gap-1.5">
                            Bill ID: #{bill.id.slice(0, 8).toUpperCase()}
                          </h4>
                          {bill.restaurant_order_status && (
                            <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              RESTAURANT_ORDER_STATUS_LABELS[bill.restaurant_order_status].color
                            }`}>
                              {language === "en"
                                ? RESTAURANT_ORDER_STATUS_LABELS[bill.restaurant_order_status].en
                                : RESTAURANT_ORDER_STATUS_LABELS[bill.restaurant_order_status].ur}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold block">PKR {bill.total_amount}</div>
                          <div className={`text-[10px] font-medium block mt-1 flex items-center gap-1 justify-end ${
                            isSelected ? "text-slate-400" : "text-slate-500"
                          }`}>
                            <Clock className="h-3 w-3" /> {getMinutesAgo(bill.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-slate-200/20 text-xs">
                        <div className={isSelected ? "text-slate-400" : "text-slate-500"}>
                          {totalItems} Item{totalItems > 1 ? "s" : ""}
                        </div>
                        <div className={isSelected ? "text-slate-300 font-bold" : "text-slate-700 font-bold"}>
                          View Details <ChevronRight className="inline-block h-3.5 w-3.5 align-middle" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Bill Detail Display (Right Side - 7 Columns) */}
          <div className="lg:col-span-7">
            {selectedBill ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                
                {/* Bill Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
                  <div>
                    <div className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                      {selectedBill.tableName}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">
                      Bill ID: #{selectedBill.id.slice(0, 8).toUpperCase()}
                    </h3>
                    {selectedBill.restaurant_order_status && (
                      <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        RESTAURANT_ORDER_STATUS_LABELS[selectedBill.restaurant_order_status].color
                      }`}>
                        {language === "en"
                          ? RESTAURANT_ORDER_STATUS_LABELS[selectedBill.restaurant_order_status].en
                          : RESTAURANT_ORDER_STATUS_LABELS[selectedBill.restaurant_order_status].ur}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === "en"
                        ? `Kitchen tickets for this bill: ${kitchenTicketCount}`
                        : `کچن KOT: ${kitchenTicketCount}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditing ? (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => { setIsEditing(false); setEditItems([]); }}
                          className="border-slate-200 text-slate-700 hover:text-slate-800"
                        >
                          <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveBillEdits}
                          disabled={isSavingEdits}
                          className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-100"
                        >
                          {isSavingEdits ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" /> Save Changes
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleSendKitchenTicket}
                          disabled={isSendingKot || (selectedBill.invoice_items?.length ?? 0) === 0}
                          className="border-amber-200 text-amber-900 hover:bg-amber-50"
                        >
                          {isSendingKot ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ChefHat className="mr-2 h-4 w-4" />
                          )}
                          {language === "en" ? "Send KOT" : "KOT بھیجیں"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={startEditing}
                          className="border-slate-200 text-slate-700 hover:text-slate-850"
                        >
                          <Edit className="mr-1.5 h-4 w-4 text-blue-600" /> 
                          {language === "en" ? "Modify Bill" : "بل ایڈٹ کریں"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => printGuestReceipt(selectedBill)}
                          className="border-slate-200 text-slate-700 hover:text-slate-800"
                        >
                          <Printer className="mr-2 h-4 w-4" /> 
                          {language === "en" ? "Print Guest Bill" : "سلپ پرنٹ کریں"}
                        </Button>
                        <Button 
                          onClick={handleOpenCheckout}
                          disabled={!!selectedBill.restaurant_order_status && !canSettleOrder(selectedBill.restaurant_order_status)}
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 disabled:opacity-50"
                        >
                          <CreditCard className="mr-2 h-4 w-4" /> 
                          {language === "en" ? "Settle / Checkout" : "چیک آؤٹ بل"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit Mode Add Products Search Section */}
                {isEditing && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 relative">
                    <label className="block text-xs font-bold text-slate-600 uppercase">
                      {language === "en" ? "Add Items to Bill" : "بل میں اشیاء شامل کریں"}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder={language === "en" ? "Search dishes/menu items..." : "کھانا یا مشروب تلاش کریں..."}
                        value={productSearch}
                        onChange={e => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="pl-9 bg-white border-slate-200 rounded-xl"
                      />
                      {showProductDropdown && productSearch.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-[220px] overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 text-center">No products found</div>
                          ) : (
                            filteredProducts.slice(0, 6).map(prod => (
                              <div
                                key={prod.id}
                                onClick={() => addProductToEditBill(prod)}
                                className="p-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-sm font-semibold text-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-50"
                              >
                                <div>{prod.name}</div>
                                <div className="text-xs text-blue-600 font-bold">PKR {prod.sale_price_single}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {language === "en" ? "Ordered Items" : "آرڈر کیے گئے آئٹمز"}
                  </h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner overflow-x-auto w-full custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                          <th className="p-3">Dish / Item Name</th>
                          <th className="p-3 text-center">Quantity</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-right">Subtotal</th>
                          {isEditing && <th className="p-3 text-center w-[60px]">Delete</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {isEditing ? (
                          editItems.map((item) => (
                            <tr key={item.product_id} className="border-b border-slate-50 text-sm text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                              <td className="p-3 font-semibold text-slate-800">{item.products?.name || "Unknown Item"}</td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    onClick={() => adjustEditQty(item.product_id, -1)}
                                    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <div className="font-extrabold text-sm w-6">{item.quantity}</div>
                                  <button 
                                    onClick={() => adjustEditQty(item.product_id, 1)}
                                    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 text-right">{item.unit_price}</td>
                              <td className="p-3 text-right font-extrabold text-slate-800">{item.subtotal}</td>
                              <td className="p-3 text-center">
                                <button 
                                  onClick={() => deleteEditItem(item.product_id)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          selectedBill.invoice_items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-50 text-sm text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                              <td className="p-3 font-semibold text-slate-800">{item.products?.name || "Unknown Item"}</td>
                              <td className="p-3 text-center font-bold text-slate-600">{item.quantity}</td>
                              <td className="p-3 text-right">{item.unit_price}</td>
                              <td className="p-3 text-right font-extrabold text-slate-800">{item.subtotal}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bill Totals Card */}
                <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col gap-2.5">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold uppercase">
                    <div>Subtotal:</div>
                    <div>PKR {isEditing 
                      ? editItems.reduce((sum, item) => sum + item.subtotal, 0)
                      : selectedBill.invoice_items.reduce((sum, item) => sum + item.subtotal, 0)
                    }</div>
                  </div>
                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between text-xs text-red-500 font-semibold uppercase">
                      <div>Discount:</div>
                      <div>-PKR {selectedBill.discount}</div>
                    </div>
                  )}
                  {selectedBill.tax_amount > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 font-semibold uppercase">
                      <div>Tax ({selectedBill.tax_rate}%):</div>
                      <div>+PKR {isEditing
                        ? (editItems.reduce((sum, item) => sum + item.subtotal, 0) * (selectedBill.tax_rate || 0)) / 100
                        : selectedBill.tax_amount
                      }</div>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-slate-800 text-base border-t border-slate-200/50 pt-2.5">
                    <div>Grand Total:</div>
                    <div>PKR {isEditing
                      ? (() => {
                          const sub = editItems.reduce((sum, item) => sum + item.subtotal, 0);
                          const tax = (sub * (selectedBill.tax_rate || 0)) / 100;
                          return Math.max(0, sub + tax - (selectedBill.discount || 0));
                        })()
                      : selectedBill.total_amount
                    }</div>
                  </div>
                </div>

                {/* Quick Info Alerts */}
                <div className="flex gap-2.5 p-3 rounded-xl bg-blue-50/40 border border-blue-50 text-xs text-blue-700 leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Guest Bill status:</strong> This bill is currently in draft state and is not counted towards your active revenue. Once you settle payments, it will be finalized.
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
                <p className="text-slate-500 text-xs">Select a bill from the queue on the left to view details.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Settle Settlement Checkout Modal Dialog */}
      {isCheckoutOpen && selectedBill && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden"
          >
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="text-blue-600 h-5 w-5" /> Settle Table Bill
                </h3>
                <p className="text-slate-500 text-[10px] mt-0.5">Settle bill #{selectedBill.id.slice(0, 8).toUpperCase()} - {selectedBill.tableName}</p>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* Payment Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "card", "credit"].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode as any)}
                      className={`py-2 px-3 text-xs font-bold border rounded-xl capitalize transition-all ${
                        paymentMode === mode 
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjustments: Discount & Tax */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Discount (PKR)</label>
                  <Input 
                    type="number"
                    value={discountVal}
                    onChange={e => setDiscountVal(Number(e.target.value))}
                    className="border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tax Rate (%)</label>
                  <Input 
                    type="number"
                    value={taxRateVal}
                    onChange={e => setTaxRateVal(Number(e.target.value))}
                    className="border-slate-200"
                  />
                </div>
              </div>

              {/* Waiter Selection */}
              {selectedBill.tableName !== "Delivery" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Waiter (ویٹر)</label>
                  <select
                    value={selectedWaiterId}
                    onChange={e => setSelectedWaiterId(e.target.value)}
                    className="w-full text-sm border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700"
                  >
                    <option value="">No Waiter Assigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rider Selection */}
              {(selectedBill.tableName === "Takeaway Order" || selectedBill.tableName === "Delivery") && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Rider (رائڈر)</label>
                  <select
                    value={selectedRiderId}
                    onChange={e => setSelectedRiderId(e.target.value)}
                    className="w-full text-sm border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700"
                  >
                    <option value="">No Rider Assigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cash Account Selection */}
              {paymentMode !== "credit" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Deposit Cash Account</label>
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full text-sm border border-slate-200 p-2 rounded-lg bg-white"
                  >
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} (PKR {a.current_balance})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Party Selection (Credit Mode) */}
              {paymentMode === "credit" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Customer / Party</label>
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="w-full text-sm border border-slate-200 p-2 rounded-lg bg-white"
                  >
                    <option value="walkin">Walk-in Guest (No Credit balance)</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Balance: PKR {c.current_balance})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Received Amount entry (Credit Mode) */}
              {paymentMode === "credit" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Paid Amount (PKR)</label>
                  <Input 
                    type="number"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(Number(e.target.value))}
                    className="border-slate-200 font-extrabold text-slate-800"
                  />
                </div>
              )}

              {/* Totals Summary */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <div>Subtotal:</div>
                  <div>PKR {subtotal}</div>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-xs text-red-500 font-bold">
                    <div>Discount:</div>
                    <div>-PKR {discountVal}</div>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <div>Tax:</div>
                    <div>+PKR {taxAmount}</div>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-slate-800 border-t border-slate-200 pt-2 text-sm">
                  <div>Net Total:</div>
                  <div>PKR {netTotal}</div>
                </div>
                {paymentMode === "credit" && (
                  <div className="flex justify-between font-bold text-red-600 pt-1 text-xs">
                    <div>Remaining Due:</div>
                    <div>PKR {remainingDue}</div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <Button 
                variant="outline" 
                onClick={() => setIsCheckoutOpen(false)}
                className="border-slate-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCheckout}
                disabled={isSubmittingCheckout || (paymentMode === "credit" && selectedCustomerId === "walkin" && remainingDue > 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100 font-bold"
              >
                {isSubmittingCheckout ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  "Complete Settlement"
                )}
              </Button>
            </div>

          </motion.div>
        </div>
      )}

    </div>
  );
}
