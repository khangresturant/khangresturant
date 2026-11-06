"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  settleRestaurantOrder,
  applyRestaurantOrderCostAndStock,
  invoiceLinesForCost,
} from "@/lib/restaurant-orders";
import {
  countKitchenTicketsForInvoice,
  dispatchKitchenTicket,
} from "@/lib/restaurant-kitchen";
import { printRestaurantPaidReceipt } from "@/lib/restaurant-receipt-print";
import {
  restoreStockForInvoiceLines,
  type InvoiceLineForCost,
} from "@/lib/restaurant-recipe-cost";
import {
  buildRestaurantEditHistoryEntry,
  computeKitchenDispatchDelta,
  loadRestaurantBillEditPrefs,
  mapInvoiceRowsToHistoryItems,
  parseRestaurantEditHistory,
  saveRestaurantBillEditPrefs,
  type RestaurantBillEditHistoryEntry,
  type RestaurantBillEditPrefs,
} from "@/lib/restaurant-bill-edit";
import {
  companyRowToShopDetails,
  mergeRestaurantPrintProfile,
} from "@/lib/restaurant-print-profile";
import {
  filterRiderStaff,
  isDeliveryService,
  pickAccountForPayment,
  RESTAURANT_PAYMENT_MODES,
  riderLabel,
  staffPhone,
  type RestaurantPaymentMode,
} from "@/lib/restaurant-riders";
import {
  mapDbInvoiceItemsToReceiptLines,
  printRestaurantGuestBill,
  printRestaurantKOTSlip,
  printRestaurantRevisedGuestBill,
} from "@/lib/restaurant-receipt-print";
import { RestaurantBillEditHistoryModal } from "@/components/restaurant/RestaurantBillEditHistoryModal";

type InvoiceItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  packing_name?: string | null;
  menu_size_id?: string | null;
  products: {
    name: string;
    purchase_price_single: number;
  } | null;
};

type DraftInvoice = {
  id: string;
  created_at: string;
  order_number?: string | null;
  total_amount: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  party_id: string | null;
  payment_mode: string | null;
  status: string;
  is_edited?: boolean;
  edit_history?: RestaurantBillEditHistoryEntry[] | null;
  waiter_id?: string | null;
  rider_id?: string | null;
  restaurant_order_status?: RestaurantOrderStatus | null;
  bill_printed_at?: string | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  special_instructions?: string | null;
  delivery_fee?: number | null;
  additional_charges?: number | null;
  parties: {
    name: string;
    phone?: string | null;
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
  const { shopId, userId, shopName, shopPhone, shopAddress, shopEmail, userName } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const billFromUrl = searchParams.get("bill");

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
  const [billEditPrefs, setBillEditPrefs] = useState<RestaurantBillEditPrefs>(() =>
    loadRestaurantBillEditPrefs(null)
  );
  const [showBillEditSettings, setShowBillEditSettings] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<RestaurantBillEditHistoryEntry[]>([]);

  // Settlement & Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [isSendingKot, setIsSendingKot] = useState(false);
  const [kitchenTicketCount, setKitchenTicketCount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<RestaurantPaymentMode>("cash");
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

  useEffect(() => {
    if (shopId) setBillEditPrefs(loadRestaurantBillEditPrefs(shopId));
  }, [shopId]);

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
          order_number,
          total_amount,
          discount,
          tax_rate,
          tax_amount,
          party_id,
          payment_mode,
          status,
          is_edited,
          edit_history,
          waiter_id,
          rider_id,
          restaurant_order_status,
          bill_printed_at,
          service_type,
          stock_deducted,
          customer_name,
          customer_phone,
          customer_address,
          special_instructions,
          delivery_fee,
          additional_charges,
          parties ( name, phone ),
          invoice_items (
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            packing_name,
            menu_size_id,
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
          edit_history: parseRestaurantEditHistory(inv.edit_history),
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

      // 6. Fetch print settings & company (receipt header + dual printers)
      const [{ data: printData }, { data: companyData }] = await Promise.all([
        supabase.from("print_settings").select("*").eq("shop_id", shopId).maybeSingle(),
        supabase.from("company_details").select("*").eq("shop_id", shopId).maybeSingle(),
      ]);
      if (companyData) setCompanyDetails(companyData);
      setReceiptSettings(
        mergeRestaurantPrintProfile(
          companyData as Record<string, unknown> | null,
          printData as Record<string, unknown> | null
        )
      );

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
        .select("id, name, role, phone, permissions")
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
    if (!billFromUrl || bills.length === 0) return;
    const match = bills.find((b) => b.id === billFromUrl);
    if (match) setSelectedBill(match);
  }, [billFromUrl, bills]);

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
      printRestaurantKOTSlip(
        {
          orderNumber: selectedBill.order_number,
          tableName: selectedBill.tableName || null,
          serviceType: selectedBill.service_type,
          ...billGuestDetails(selectedBill),
          items: lines.map((l) => {
            const prod = selectedBill.invoice_items?.find((i) => i.product_id === l.product_id);
            return {
              name: prod?.products?.name || "Item",
              quantity: l.quantity,
              sizeLabel: prod?.packing_name || null,
            };
          }),
          settings: receiptSettings,
          shopDetails: shopDetailsForPrint(),
          companyRow: companyDetails,
        },
        { onError: (msg) => toast.error(msg) }
      );
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

      const { data: prevInv } = await supabase
        .from("invoices")
        .select("total_amount, tax_amount, discount, tax_rate, status, paid_amount, edit_history, stock_deducted, restaurant_order_status, bill_printed_at")
        .eq("id", invoiceId)
        .single();

      const previousItems = mapInvoiceRowsToHistoryItems(selectedBill.invoice_items || []);
      const nextItems = mapInvoiceRowsToHistoryItems(
        editItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          packing_name: item.packing_name,
          products: item.products,
        }))
      );

      const historyEntry = buildRestaurantEditHistoryEntry({
        invoice: prevInv || selectedBill,
        previousItems,
        nextItems,
        editedBy: userName,
      });

      const oldHistory = parseRestaurantEditHistory(prevInv?.edit_history);
      const updatedHistory = [historyEntry, ...oldHistory];

      if (prevInv?.stock_deducted && selectedBill.invoice_items?.length) {
        await restoreStockForInvoiceLines(
          supabase,
          invoiceLinesForCost(
            selectedBill.invoice_items.map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity,
              packing_name: it.packing_name,
              menu_size_id: it.menu_size_id,
            }))
          )
        );
      }

      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

      const itemsToInsert = editItems.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        packing_name: item.packing_name || null,
        menu_size_id: item.menu_size_id || null,
      }));

      const { error: insertErr } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (insertErr) throw insertErr;

      const newSubtotal = editItems.reduce((sum, item) => sum + item.subtotal, 0);
      const newTaxAmount = (newSubtotal * (selectedBill.tax_rate || 0)) / 100;
      const newNetTotal = Math.max(0, newSubtotal + newTaxAmount - (selectedBill.discount || 0));

      const wasBillPrinted = prevInv?.restaurant_order_status === "bill_printed";
      const nextOrderStatus =
        wasBillPrinted || prevInv?.bill_printed_at
          ? "ready"
          : prevInv?.restaurant_order_status || selectedBill.restaurant_order_status;

      const { error: invErr } = await supabase
        .from("invoices")
        .update({
          total_amount: newNetTotal,
          tax_amount: newTaxAmount,
          is_edited: true,
          edit_history: updatedHistory,
          restaurant_order_status: nextOrderStatus,
          bill_printed_at: wasBillPrinted ? null : prevInv?.bill_printed_at,
          stock_deducted: false,
        })
        .eq("id", invoiceId);

      if (invErr) throw invErr;

      await applyRestaurantOrderCostAndStock(
        supabase,
        invoiceId,
        invoiceLinesForCost(
          itemsToInsert.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            packing_name: it.packing_name,
            menu_size_id: it.menu_size_id,
          }))
        ),
        newNetTotal
      );

      toast.success(
        language === "en"
          ? "Bill updated - reprint revised guest slip."
          : "بل اپڈیٹ - نیا بل پرنٹ کریں۔"
      );
      setIsEditing(false);

      await loadData();

      if (billEditPrefs.autoReprintAfterEdit) {
        const lines = mapDbInvoiceItemsToReceiptLines(
          editItems.map((i) => ({
            quantity: i.quantity,
            unit_price: i.unit_price,
            packing_name: i.packing_name,
            products: i.products,
          }))
        );
        printRestaurantRevisedGuestBill(
          {
            invoiceId,
            orderNumber: selectedBill.order_number,
            tableName: selectedBill.tableName || null,
            serviceType: selectedBill.service_type,
            ...billGuestDetails(selectedBill),
            items: lines,
            subtotal: newSubtotal,
            discount: selectedBill.discount || 0,
            taxRate: selectedBill.tax_rate || 0,
            taxAmount: newTaxAmount,
            netTotal: newNetTotal,
            settings: receiptSettings,
            shopDetails: shopDetailsForPrint(),
            companyRow: companyDetails,
            revisionNumber: updatedHistory.length,
            previousTotal: Number(prevInv?.total_amount ?? selectedBill.total_amount),
            editedAt: historyEntry.edited_at,
            editedBy: historyEntry.edited_by,
            changes: historyEntry.changes,
            showChangeDetails: billEditPrefs.showChangeDetailsOnReceipt,
          },
          {
            onError: (msg) => toast.error(msg),
          }
        );
      }

      const kitchenDelta = computeKitchenDispatchDelta(previousItems, nextItems);
      if (
        billEditPrefs.dispatchKitchenTicketOnBillEdit &&
        kitchenDelta.length > 0 &&
        shopId
      ) {
        await dispatchKitchenTicket(supabase, {
          shopId,
          invoiceId,
          tableId: selectedBill.tableId || null,
          waiterId: selectedBill.waiter_id || null,
          lines: kitchenDelta.map((d) => ({
            product_id: d.product_id,
            quantity: d.quantity,
          })),
        });
      }

      const hasChanges = (historyEntry.changes?.length ?? 0) > 0;
      if (billEditPrefs.autoPrintKotAfterBillEdit && hasChanges) {
        const prepareNow = kitchenDelta.map((d) => ({
          name: d.name,
          quantity: d.quantity,
          sizeLabel: d.packing_name || null,
        }));
        printRestaurantKOTSlip(
          {
            orderNumber: selectedBill.order_number,
            tableName: selectedBill.tableName || null,
            serviceType: selectedBill.service_type,
            ...billGuestDetails(selectedBill),
            items: prepareNow,
            settings: receiptSettings,
            shopDetails: shopDetailsForPrint(),
            companyRow: companyDetails,
            billAmendment: {
              revisionNumber: updatedHistory.length,
              editedAt: historyEntry.edited_at,
              editedBy: historyEntry.edited_by,
              changes: historyEntry.changes,
              showChangeDetails: billEditPrefs.showChangeDetailsOnKot,
              prepareNow,
            },
          },
          {
            onError: (msg) =>
              toast.error(
                language === "en"
                  ? msg
                  : `${msg} - کچن پرنٹر Business Details میں سیٹ کریں`
              ),
          }
        );
      }
    } catch (err: any) {
      toast.error("Failed to save bill changes: " + err.message);
    } finally {
      setIsSavingEdits(false);
    }
  };

  const openBillEditHistory = () => {
    if (!selectedBill) return;
    setHistoryRows(parseRestaurantEditHistory(selectedBill.edit_history));
    setHistoryOpen(true);
  };

  const handleReprintRevisedBill = () => {
    if (!selectedBill) return;
    const history = parseRestaurantEditHistory(selectedBill.edit_history);
    const latest = history[0];
    const lines = mapDbInvoiceItemsToReceiptLines(selectedBill.invoice_items || []);
    const subtotal = lines.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    printRestaurantRevisedGuestBill(
      {
        invoiceId: selectedBill.id,
        orderNumber: selectedBill.order_number,
        tableName: selectedBill.tableName || null,
        serviceType: selectedBill.service_type,
        ...billGuestDetails(selectedBill),
        items: lines,
        subtotal,
        discount: selectedBill.discount || 0,
        taxRate: selectedBill.tax_rate || 0,
        taxAmount: selectedBill.tax_amount || 0,
        netTotal: selectedBill.total_amount,
        settings: receiptSettings,
        shopDetails: {
          name: companyDetails?.name || shopName || "Restaurant",
          phone: companyDetails?.phone || shopPhone,
          address: companyDetails?.address || shopAddress,
          email: companyDetails?.email || shopEmail,
        },
        companyRow: companyDetails,
        revisionNumber: Math.max(1, history.length),
        previousTotal: latest ? latest.total_amount : selectedBill.total_amount,
        editedAt: latest?.edited_at,
        editedBy: latest?.edited_by,
        changes: latest?.changes,
        showChangeDetails: billEditPrefs.showChangeDetailsOnReceipt,
        createdAt: selectedBill.created_at,
      },
      { onError: (msg) => toast.error(msg) }
    );
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
    setPaymentMode("cash");
    if (cashAccounts.length) {
      setSelectedAccountId(pickAccountForPayment(cashAccounts, "cash"));
    }
    setIsCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    if (!selectedBill || !shopId) return;
    if (isDeliveryService(selectedBill.service_type) && !selectedRiderId) {
      toast.error(
        language === "en"
          ? "Assign a rider before settling a delivery order."
          : "ڈیلیوری بل سیٹل کرنے سے پہلے رائیڈر لگائیں۔"
      );
      return;
    }
    setIsSubmittingCheckout(true);
    try {
      const activeInvoiceId = selectedBill.id;
      const paidAmt = paymentMode === "credit" ? receivedAmount : netTotal;

      await settleRestaurantOrder(supabase, {
        shopId,
        invoiceId: activeInvoiceId,
        items: selectedBill.invoice_items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          menu_size_id: item.menu_size_id,
          packing_name: item.packing_name,
        })),
        netTotal,
        taxAmount,
        taxRate: taxRateVal,
        discount: discountVal,
        paymentMode,
        receivedAmount,
        partyId: selectedCustomerId === "walkin" ? null : selectedCustomerId,
        accountId: paymentMode !== "credit" ? selectedAccountId : null,
        registerSessionId: activeSession?.id || null,
        waiterId: selectedWaiterId || null,
        riderId: selectedRiderId || null,
        tableId: selectedBill.tableId || null,
      });

      toast.success("Bill checked out - printing thermal receipt…");
      setIsCheckoutOpen(false);

      printRestaurantPaidReceipt(
        {
          invoiceId: activeInvoiceId,
          orderNumber: null,
          tableName: selectedBill.tableName,
          serviceType: selectedBill.service_type,
          ...billGuestDetails(selectedBill),
          customerName:
            customers.find((c) => c.id === selectedCustomerId)?.name ||
            selectedBill.customer_name ||
            selectedBill.parties?.name ||
            "Walk-in Guest",
          customerPhone:
            selectedBill.customer_phone ||
            customers.find((c) => c.id === selectedCustomerId)?.phone ||
            selectedBill.parties?.phone ||
            null,
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
          companyRow: companyDetails,
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

  const shopDetailsForPrint = () =>
    companyRowToShopDetails(companyDetails, shopName);

  const staffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.name || null;

  const billGuestDetails = (bill: DraftInvoice) => ({
    customerName: bill.customer_name || bill.parties?.name || null,
    customerPhone: bill.customer_phone || bill.parties?.phone || null,
    customerAddress: bill.customer_address || null,
    waiterName: staffName(bill.waiter_id),
    riderName: staffName(bill.rider_id),
    riderPhone: staffPhone(staff.find((s) => s.id === bill.rider_id)),
    specialInstructions: bill.special_instructions || null,
    deliveryFee: Number(bill.delivery_fee || 0),
    additionalCharges: Number(bill.additional_charges || 0),
  });

  const printGuestReceipt = async (billObj: DraftInvoice) => {
    if (billObj.status === "draft") {
      try {
        await markBillPrinted(supabase, billObj.id);
        setBills((prev) =>
          prev.map((b) =>
            b.id === billObj.id
              ? {
                  ...b,
                  restaurant_order_status: "bill_printed" as RestaurantOrderStatus,
                  bill_printed_at: new Date().toISOString(),
                }
              : b
          )
        );
        if (selectedBill?.id === billObj.id) {
          setSelectedBill((prev) =>
            prev
              ? {
                  ...prev,
                  restaurant_order_status: "bill_printed",
                  bill_printed_at: new Date().toISOString(),
                }
              : prev
          );
        }
      } catch (e: any) {
        toast.error(e.message);
        return;
      }
    }

    const lines = mapDbInvoiceItemsToReceiptLines(billObj.invoice_items || []);
    const sub = lines.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const taxAmt = billObj.tax_amount || (sub * (billObj.tax_rate || 0)) / 100;
    const net = billObj.total_amount;

    printRestaurantGuestBill(
      {
        invoiceId: billObj.id,
        orderNumber: billObj.order_number,
        tableName: billObj.tableName || null,
        serviceType: billObj.service_type,
        ...billGuestDetails(billObj),
        items: lines,
        subtotal: sub,
        discount: billObj.discount || 0,
        taxRate: billObj.tax_rate || 0,
        taxAmount: taxAmt,
        netTotal: net,
        settings: receiptSettings,
        shopDetails: shopDetailsForPrint(),
        companyRow: companyDetails,
        createdAt: billObj.created_at,
      },
      {
        onError: (msg) =>
          toast.error(
            language === "en"
              ? `${msg} Set default thermal printer in Windows.`
              : `${msg} - Windows میں تھرمل پرنٹر ڈیفالٹ بنائیں`
          ),
      }
    );
    toast.success(language === "en" ? "Guest bill sent to thermal printer." : "بل تھرمل پرنٹر پر بھیجا گیا۔");
  };

  const filteredBills = bills.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      (b.tableName || "").toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.order_number || "").toLowerCase().includes(q) ||
      (b.customer_name || "").toLowerCase().includes(q) ||
      (b.customer_phone || "").includes(searchQuery) ||
      (b.parties?.name || "").toLowerCase().includes(q)
    );
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
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 text-xs h-8">
              {language === "en" ? "Receipt / Logo" : "رسید و لوگو"}
            </Button>
          </Link>
          <Button
            variant="outline"
            type="button"
            onClick={() => setShowBillEditSettings((v) => !v)}
            className="border-slate-200 text-slate-600"
          >
            {language === "en" ? "Bill edit settings" : "بل ایڈٹ سیٹنگ"}
          </Button>
        </div>
      </div>

      {showBillEditSettings && shopId && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-3">
          <p className="font-bold text-slate-700">
            {language === "en" ? "Revised bill print (sidebar settings)" : "ریvised بل پرنٹ سیٹنگ"}
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billEditPrefs.autoReprintAfterEdit}
              onChange={(e) => {
                const next = { ...billEditPrefs, autoReprintAfterEdit: e.target.checked };
                setBillEditPrefs(next);
                saveRestaurantBillEditPrefs(shopId, next);
              }}
            />
            <div>{language === "en" ? "Auto reprint revised slip after save" : "محفوظ کے بعد خود revised slip پرنٹ"}</div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billEditPrefs.showChangeDetailsOnReceipt}
              onChange={(e) => {
                const next = { ...billEditPrefs, showChangeDetailsOnReceipt: e.target.checked };
                setBillEditPrefs(next);
                saveRestaurantBillEditPrefs(shopId, next);
              }}
            />
            <div>
              {language === "en"
                ? "Show item changes on revised thermal bill"
                : "تھرمل بل پر آئٹم تبدیلیاں دکھائیں"}
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billEditPrefs.autoPrintKotAfterBillEdit !== false}
              onChange={(e) => {
                const next = { ...billEditPrefs, autoPrintKotAfterBillEdit: e.target.checked };
                setBillEditPrefs(next);
                saveRestaurantBillEditPrefs(shopId, next);
              }}
            />
            <div>
              {language === "en"
                ? "Auto print amendment KOT to kitchen printer after bill edit"
                : "بل ایڈٹ کے بعد کچن KOT (تبدیلیاں) خود پرنٹ"}
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billEditPrefs.showChangeDetailsOnKot !== false}
              onChange={(e) => {
                const next = { ...billEditPrefs, showChangeDetailsOnKot: e.target.checked };
                setBillEditPrefs(next);
                saveRestaurantBillEditPrefs(shopId, next);
              }}
            />
            <div>
              {language === "en"
                ? "Show ADD / CANCEL / qty changes on amendment KOT"
                : "KOT پر منسوخ/نیا/مقدار تبدیلی دکھائیں"}
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billEditPrefs.dispatchKitchenTicketOnBillEdit !== false}
              onChange={(e) => {
                const next = {
                  ...billEditPrefs,
                  dispatchKitchenTicketOnBillEdit: e.target.checked,
                };
                setBillEditPrefs(next);
                saveRestaurantBillEditPrefs(shopId, next);
              }}
            />
            <div>
              {language === "en"
                ? "Send new qty to Kitchen KDS queue on bill edit"
                : "بل ایڈٹ پر نئی مقدار KDS میں بھیجیں"}
            </div>
          </label>
        </div>
      )}

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
                      {selectedBill.order_number ? (
                        <div className="text-sm font-normal text-slate-500 ml-2">· {selectedBill.order_number}</div>
                      ) : null}
                    </h3>
                    {selectedBill.is_edited && (
                      <div className="inline-block mt-1 text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
                        {language === "en" ? "Edited bill" : "ایڈٹ شدہ بل"}
                      </div>
                    )}
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
                        {(selectedBill.is_edited || (selectedBill.edit_history?.length ?? 0) > 0) && (
                          <>
                            <Button variant="outline" size="sm" onClick={openBillEditHistory}>
                              {language === "en" ? "Edit history" : "تاریخ"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleReprintRevisedBill}>
                              <Printer className="mr-1 h-3 w-3" />
                              {language === "en" ? "Reprint revised" : "نیا بل پرنٹ"}
                            </Button>
                          </>
                        )}
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
                <div className="grid grid-cols-5 gap-1.5">
                  {RESTAURANT_PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setPaymentMode(mode.id);
                        if (mode.id !== "credit" && cashAccounts.length) {
                          setSelectedAccountId(pickAccountForPayment(cashAccounts, mode.id));
                        }
                      }}
                      className={`py-2 px-1 text-[10px] font-bold border rounded-xl transition-all ${
                        paymentMode === mode.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {language === "en" ? mode.label : mode.labelUr}
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

              {!isDeliveryService(selectedBill.service_type) && (
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

              {isDeliveryService(selectedBill.service_type) && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Delivery rider (required)
                  </label>
                  <select
                    value={selectedRiderId}
                    onChange={e => setSelectedRiderId(e.target.value)}
                    className="w-full text-sm border border-slate-200 p-2 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700"
                  >
                    <option value="">Select rider…</option>
                    {filterRiderStaff(staff).map((s) => (
                      <option key={s.id} value={s.id}>
                        {riderLabel(s) || `${s.name} (${s.role})`}
                      </option>
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

      <RestaurantBillEditHistoryModal
        open={historyOpen}
        title={
          selectedBill
            ? `Bill edit history · #${selectedBill.order_number || selectedBill.id.slice(0, 8).toUpperCase()}`
            : "Bill edit history"
        }
        onClose={() => setHistoryOpen(false)}
        history={historyRows}
        currentBill={
          selectedBill
            ? {
                total_amount: selectedBill.total_amount,
                discount: selectedBill.discount,
                tax_amount: selectedBill.tax_amount,
              }
            : null
        }
        currentItems={(selectedBill?.invoice_items || []).map((i) => ({
          name: i.products?.name || "Item",
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))}
        language={language === "ur" ? "ur" : "en"}
      />

    </div>
  );
}
